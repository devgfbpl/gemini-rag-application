from pypdf import PdfReader

reader = PdfReader(r'C:\Users\devgf\Downloads\7. Dev_Portfolio_Knowledge_Base_ FAQ_RAG.pdf')
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open("knowledge.txt", "w", encoding="utf-8") as f:
    f.write(text)
print("done")
