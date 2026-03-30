import React, { useState } from "react";

const BulkAudioUploadForm = () => {
  const [bookId, setBookId]     = useState("");
  const [narrator, setNarrator] = useState("");
  const [audioFiles, setAudioFiles] = useState([]);
  const [message, setMessage]   = useState("");
  const [results, setResults]   = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files);

    // Warn about any files that don't follow the naming convention
    const invalid = selected.filter(
      f => !/page\s*\d+/i.test(pathinfo(f.name))
    );
    if (invalid.length > 0) {
      setMessage(
        `Warning: These files don't follow "Page X" naming and will be skipped: 
        ${invalid.map(f => f.name).join(", ")}`
      );
    }
    setAudioFiles(selected);
  };

  // Helper to strip extension for display matching backend logic
  const pathinfo = (filename) => filename.replace(/\.[^/.]+$/, "");

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!bookId || !narrator || audioFiles.length === 0) {
      setMessage("Please fill out all fields and select at least one audio file.");
      return;
    }

    const formData = new FormData();
    formData.append("book_id", bookId);
    formData.append("narrator", narrator);
    audioFiles.forEach(file => {
      formData.append("audios[]", file);
    });

    setIsUploading(true);
    setMessage("");
    setResults(null);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/audio/universal/bulk-upload",
        { method: "POST", body: formData }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setResults(data);
        setBookId("");
        setNarrator("");
        setAudioFiles([]);
      } else {
        setMessage(`Error: ${data.message || "Upload failed"}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setMessage("A network error occurred. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mt-5">
      <h2>Bulk Upload Universal Audio</h2>
      <p className="text-muted">
        Files must be named <strong>Page 1.mp3</strong>, <strong>Page 2.mp3</strong> etc.
      </p>

      <form onSubmit={handleUpload}>
        <div className="mb-3">
          <label className="form-label">Book ID</label>
          <input
            type="number"
            className="form-control"
            value={bookId}
            onChange={e => setBookId(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Narrator Name</label>
          <input
            type="text"
            className="form-control"
            value={narrator}
            onChange={e => setNarrator(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">
            Audio Files (MP3/WAV/M4A — named Page 1, Page 2...)
          </label>
          <input
            type="file"
            className="form-control"
            accept="audio/*"
            multiple
            onChange={handleFilesChange}
            required
          />
          {audioFiles.length > 0 && (
            <small className="text-muted">
              {audioFiles.length} file(s) selected: {audioFiles.map(f => f.name).join(", ")}
            </small>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-success"
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Bulk Upload Audio"}
        </button>
      </form>

      {message && (
        <div className={`mt-3 alert ${results?.errors?.length ? "alert-warning" : "alert-info"}`}>
          {message}
        </div>
      )}

      {results && (
        <div className="mt-3">
          <p><strong>Created:</strong> {results.created_count} &nbsp;
             <strong>Updated:</strong> {results.updated_count}
          </p>

          {results.errors?.length > 0 && (
            <div className="alert alert-danger">
              <strong>Skipped files:</strong>
              <ul>{results.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
            </div>
          )}

          <table className="table table-sm table-bordered mt-2">
            <thead>
              <tr>
                <th>Page</th>
                <th>Narrator</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {results.records
                .sort((a, b) => a.page_number - b.page_number)
                .map((r, i) => (
                  <tr key={i}>
                    <td>{r.page_number}</td>
                    <td>{r.narrator}</td>
                    <td>
                      <audio controls src={r.audio_url.replace(
                        "/storage/",
                        "/book-backend/public/storage/"
                      )} />
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BulkAudioUploadForm;