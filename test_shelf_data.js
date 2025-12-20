// Test script to verify shelf data structure
const shelfData = [
  {
    "id": "aabd66eb-93a9-4140-97e5-efb350a32daa",
    "userId": "605db90f-4691-4281-991e-b2e248e33915",
    "name": "Загруженные",
    "description": "Загруженные книги",
    "color": "bg-blue-100 dark:bg-blue-900/20",
    "createdAt": "2025-12-17T10:44:32.749Z",
    "updatedAt": "2025-12-17T10:44:32.749Z",
    "bookIds": [
      "86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7",
      "1f219030-f53f-4acb-a8a4-872816e7a241",
      "08d1454e-0296-4587-b0d3-b9ecb96082a4",
      "6f4fef1d-c697-4661-ab43-371520c73274"
    ]
  },
  {
    "id": "36d71f0a-7eb8-4ea4-98d8-8234b132fff5",
    "userId": "605db90f-4691-4281-991e-b2e248e33915",
    "name": "Test",
    "description": null,
    "color": "bg-muted/50",
    "createdAt": "2025-12-20T14:55:55.944Z",
    "updatedAt": "2025-12-20T14:55:55.944Z",
    "bookIds": [
      "86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7",
      "08d1454e-0296-4587-b0d3-b9ecb96082a4"
    ]
  },
  {
    "id": "2d0c5233-bb40-4064-952f-6ceb17247b75",
    "userId": "605db90f-4691-4281-991e-b2e248e33915",
    "name": "Фантастика",
    "description": null,
    "color": "bg-muted/50",
    "createdAt": "2025-12-20T15:35:53.771Z",
    "updatedAt": "2025-12-20T15:35:53.771Z",
    "bookIds": [
      "86e8d03e-c6d0-42c5-baf5-bcd3378e8cf7",
      "916bf2be-9d4f-4971-827f-629b727d11ec"
    ]
  },
  {
    "id": "935fbc37-7e1f-4a83-b236-543cba12993d",
    "userId": "605db90f-4691-4281-991e-b2e248e33915",
    "name": "3",
    "description": null,
    "color": "bg-muted/50",
    "createdAt": "2025-12-20T20:20:26.427Z",
    "updatedAt": "2025-12-20T20:20:26.427Z",
    "bookIds": []
  }
];

// Test function to simulate the shelf selection
function testShelfSelection() {
  console.log("Available shelves:");
  shelfData.forEach(shelf => {
    console.log(`- ${shelf.name} (ID: ${shelf.id})`);
  });
  
  // Simulate selecting a shelf to add a book
  const bookIdToAdd = "935fbc37-7e1f-4a83-b236-543cba12993d"; // This is actually a shelf ID, not a book ID
  const selectedShelfId = "36d71f0a-7eb8-4ea4-98d8-8234b132fff5"; // Test shelf
  
  console.log(`\nAttempting to add book ${bookIdToAdd} to shelf ${selectedShelfId}`);
  
  // Verify the shelf exists
  const shelf = shelfData.find(s => s.id === selectedShelfId);
  if (!shelf) {
    console.log("ERROR: Shelf not found!");
    return;
  }
  
  console.log(`Found shelf: ${shelf.name}`);
  
  // Check if book is already in shelf
  const isAlreadyInShelf = shelf.bookIds.includes(bookIdToAdd);
  console.log(`Book already in shelf: ${isAlreadyInShelf}`);
  
  // The correct API call would be:
  console.log(`Correct API call: POST /api/shelves/${selectedShelfId}/books/${bookIdToAdd}`);
}

testShelfSelection();