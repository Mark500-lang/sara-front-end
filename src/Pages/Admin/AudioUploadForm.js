import React, { useState } from "react";

const AudioUploadForm = () => {
  const [bookId, setBookId] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [narrator, setNarrator] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [message, setMessage] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");

  const handleAudioUpload = async (e) => {
    e.preventDefault();

    if (!bookId || !pageNumber || !narrator || !audioFile) {
        setMessage("Please fill out all fields and select an audio file.");
        return;
    }

    const formData = new FormData();
    formData.append("book_id", bookId);
    formData.append("page_number", pageNumber);
    formData.append("narrator", narrator);
    formData.append("audio", audioFile);

    try {
        const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/audio/universal/upload",
        {
            method: "POST",
            body: formData,
        }
        );

        const data = await response.json();

        if (response.ok) {
        setMessage("Audio uploaded successfully!");

        // 🔧 Fix URL before saving
        let fixedUrl = data.audio_url.replace(
            "/storage/",
            "/book-backend/public/storage/"
        );

        setUploadedUrl(`${fixedUrl}`);
        setBookId("");
        setPageNumber("");
        setNarrator("");
        setAudioFile(null);
        console.log("Uploaded Audio URL:", `https://kithia.com/website_b5d91c8e${fixedUrl}`);
        } else {
        setMessage(`❌ Error: ${data.message || "Upload failed"}`);
        }
    } catch (error) {
        console.error("Upload error:", error);
        setMessage("An error occurred while uploading the audio.");
    }
    };


  return (
    <div className="container mt-5">
      <h2>Upload Page Audio</h2>
      <form onSubmit={handleAudioUpload}>
        <div className="mb-3">
          <label htmlFor="bookId" className="form-label">
            Book ID
          </label>
          <input
            type="number"
            className="form-control"
            id="bookId"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label htmlFor="pageNumber" className="form-label">
            Page Number
          </label>
          <input
            type="number"
            className="form-control"
            id="pageNumber"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label htmlFor="narrator" className="form-label">
            Narrator
          </label>
          <input
            type="text"
            className="form-control"
            id="narrator"
            value={narrator}
            onChange={(e) => setNarrator(e.target.value)}
            placeholder="e.g. John Doe"
            required
          />
        </div>

        <div className="mb-3">
          <label htmlFor="audioFile" className="form-label">
            Upload Audio File (MP3/WAV/M4A)
          </label>
          <input
            type="file"
            className="form-control"
            id="audioFile"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files[0])}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Upload Audio
        </button>
      </form>

      {message && <div className="mt-3 alert alert-info">{message}</div>}

      {uploadedUrl && (
        <div className="mt-3">
          <p>🎧 Uploaded Audio Preview:</p>
          <audio controls src={uploadedUrl}></audio>
          <p>
            🔗 File URL:{" "}
            <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">
              {uploadedUrl}
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default AudioUploadForm;
