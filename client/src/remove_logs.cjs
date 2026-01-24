const fs = require('fs');
const path = require('path');

const files = [
  'pages/Profile.tsx',
  'components/ProfileRatingsSection.tsx',
  'components/CommentsSection.tsx',
  'components/AttachmentDisplay.tsx',
  'components/GroupMembersModal.tsx'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/console\.log\([^)]*\);?/g, '');
    fs.writeFileSync(fullPath, content);
    console.log(`Removed console.log from ${file}`);
  }
});