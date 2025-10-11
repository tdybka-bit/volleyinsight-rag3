@echo off
echo Starting ChromaDB...
echo Make sure Docker is installed and running
echo.
docker run -p 8000:8000 chromadb/chroma
pause








