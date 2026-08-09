const http = require('http');

http.get('http://127.0.0.1:3000/api/mail/inbox?limit=2', (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
    if (data.length < 5000) {
      console.log('Data:', data);
    }
  });
}).on('error', err => {
  console.error('Error:', err.message);
});
