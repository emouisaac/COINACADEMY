const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: false, // Only for testing!
  tlsCAFile: `${__dirname}/rootCA.pem` // Path to CA file
});