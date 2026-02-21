const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('C:\\Users\\devgf\\Downloads\\7. Dev_Portfolio_Knowledge_Base_ FAQ_RAG.pdf');

pdf(dataBuffer).then(function (data) {
    fs.writeFileSync('knowledge.txt', data.text);
    console.log('Done rendering pdf');
}).catch(err => console.error(err));
