const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const express = require('express');

const app = express();
app.use(express.json());

// Enable CORS for dashboard development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Helper to inspect an X.509 certificate file
function parseCertFile(fileName) {
  try {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return null;
    const certBuf = fs.readFileSync(filePath);
    const cert = new crypto.X509Certificate(certBuf);

    // Format validTo and validFrom as ISO strings
    const validToDate = new Date(cert.validTo);
    const validFromDate = new Date(cert.validFrom);

    const subjectMatch = cert.subject.match(/CN=([^,]+)/);
    const domain = subjectMatch ? subjectMatch[1] : fileName.replace('.crt', '');

    return {
      domain,
      file: fileName,
      issuer: cert.issuer.replace(/CN=/, '').trim(),
      algo: 'ECDSA-SHA256',
      serialNumber: cert.serialNumber,
      validFrom: validFromDate.toISOString(),
      validTo: validToDate.toISOString(),
      fingerprint: cert.fingerprint256,
      san: cert.subjectAltName || `DNS:${domain}`,
      keyUsage: cert.keyUsage || ['Server Authentication', 'Client Authentication'],
      rawPem: certBuf.toString('utf8')
    };
  } catch (err) {
    console.error(`Error parsing cert ${fileName}:`, err.message);
    return null;
  }
}

// GET /api/certificates - List all active X.509 certs on disk
app.get('/api/certificates', (req, res) => {
  try {
    const files = fs.readdirSync(__dirname);
    const crtFiles = files.filter(f => f.endsWith('.crt') && f !== 'root_ca.crt');
    const certs = crtFiles.map(parseCertFile).filter(Boolean);
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/issue - Real backend issuance via step ca CLI
app.post('/api/issue', (req, res) => {
  const { domain, provisioner = 'mariano@smallstep.com', duration = '24h' } = req.body;
  if (!domain || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return res.status(400).json({ error: 'Valid domain name required' });
  }

  const cleanDomain = domain.trim();
  const certFile = `${cleanDomain.replace(/\./g, '_')}.crt`;
  const keyFile = `${cleanDomain.replace(/\./g, '_')}.key`;
  const passFile = path.join(__dirname, 'password.txt');

  const args = [
    'ca',
    'certificate',
    cleanDomain,
    certFile,
    keyFile,
    '--provisioner',
    provisioner,
    '--password-file',
    passFile,
    '--force'
  ];

  console.log(`Executing step ${args.join(' ')}`);

  execFile('step', args, { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error('step error:', stderr || error.message);
      return res.status(500).json({ error: stderr || error.message });
    }

    const newCert = parseCertFile(certFile);
    if (!newCert) {
      return res.status(500).json({ error: 'Certificate generated but could not be parsed' });
    }

    console.log(`Successfully issued ${certFile} for ${cleanDomain}`);
    res.json({ success: true, certificate: newCert });
  });
});

// POST /api/renew - Renew an active certificate on disk via mTLS
app.post('/api/renew', (req, res) => {
  const { certFile } = req.body;
  if (!certFile || typeof certFile !== 'string') {
    return res.status(400).json({ error: 'Valid certificate filename required' });
  }

  const cleanCert = path.basename(certFile);
  const cleanKey = cleanCert.replace(/\.crt$/, '.key');
  const certPath = path.join(__dirname, cleanCert);
  const keyPath = path.join(__dirname, cleanKey);

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return res.status(404).json({ error: `Certificate or key file not found: ${cleanCert}, ${cleanKey}` });
  }

  const args = ['ca', 'renew', cleanCert, cleanKey, '--force'];
  console.log(`Executing step ${args.join(' ')}`);

  execFile('step', args, { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error('step renew error:', stderr || error.message);
      return res.status(500).json({ error: stderr || error.message });
    }

    const updatedCert = parseCertFile(cleanCert);
    if (!updatedCert) {
      return res.status(500).json({ error: 'Certificate renewed but could not be parsed' });
    }

    console.log(`Successfully renewed ${cleanCert}`);
    res.json({ success: true, certificate: updatedCert });
  });
});

// GET /api/health - Telemetry check for step-ca daemon
app.get('/api/health', (req, res) => {
  const startTime = Date.now();
  const options = {
    hostname: 'localhost',
    port: 9000,
    path: '/health',
    method: 'GET',
    rejectUnauthorized: false
  };

  const healthReq = https.request(options, (resp) => {
    const latencyMs = Date.now() - startTime;
    let raw = '';
    resp.on('data', chunk => { raw += chunk; });
    resp.on('end', () => {
      res.json({
        status: resp.statusCode === 200 ? 'online' : 'degraded',
        latencyMs,
        statusCode: resp.statusCode,
        caUrl: 'https://localhost:9000',
        fingerprint: '84a033e84196f73bd593fad7a63e509e57fd982f02084359c4e8c5c864efc27d'
      });
    });
  });

  healthReq.on('error', (err) => {
    res.json({
      status: 'offline',
      latencyMs: Date.now() - startTime,
      error: err.message,
      caUrl: 'https://localhost:9000'
    });
  });

  healthReq.setTimeout(2500, () => {
    healthReq.destroy();
    res.json({ status: 'timeout', latencyMs: 2500 });
  });

  healthReq.end();
});

// GET /api/root-ca - Direct download of Root CA certificate
app.get('/api/root-ca', (req, res) => {
  const rootPath = path.join(__dirname, 'examples', 'pki', 'secrets', 'root_ca.crt');
  if (fs.existsSync(rootPath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="root_ca.crt"');
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.sendFile(rootPath);
  } else {
    res.status(404).send('Root CA not found');
  }
});

// Serve static files (cheatsheet.html, presentation.html, playground.html, etc.)
app.use(express.static(__dirname));

app.get('/', (req, res) => res.send('Secure Hello World!'));

const options = {
  key: fs.readFileSync(path.join(__dirname, 'localhost.key')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost.crt'))
};

https.createServer(options, app).listen(3000, () => {
  console.log('HTTPS server with API bridge running at https://localhost:3000');
});
