fetch('http://localhost:5001/api/bookmark-collections/a5dc9028-dbf0-4efb-95e9-ddea095cab5f', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4OGQ1OTk3NC02YjNmLTQ4YzctYjM2YS0zYzE3NDdjMTIzMzMiLCJhY2Nlc3NMZXZlbCI6ImFkbWluIiwiaWF0IjoxNzM3OTQyNTU0LCJleHAiOjE3Mzg1NDczNTR9.YhB2XzGzVQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ'
  }
})
.then(response => response.json())
.then(data => {
  console.log('Collection data:', JSON.stringify(data, null, 2));
  console.log('Owner profile rating:', data.ownerProfileRating);
  console.log('Owner ID:', data.ownerId);
})
.catch(error => console.error('Error:', error));