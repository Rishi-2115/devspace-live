// Test the authentication API
fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'demo@example.com',
    password: 'demo123'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Login API Response:', data);
  if (data.user) {
    console.log('✅ Login successful for user:', data.user.name);
  } else {
    console.log('❌ Login failed:', data.error);
  }
})
.catch(error => {
  console.error('❌ Network Error:', error);
});
