import React, { useState } from "react";

const BulkPDFZipUpload = () => {
  const [bookId, setBookId] = useState("");
  const [pdf, setPdf] = useState(null);
  const [zip, setZip] = useState(null);
  const [message, setMessage] = useState("");

  const upload = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("pdf_file", pdf);
    formData.append("zip_file", zip);

    const response = await fetch(
      `https://kithia.com/website_b5d91c8e/api/books/${bookId}/bulk-upload`,
      { method: "POST", body: formData }
    );

    const data = await response.json();
    setMessage(data.message);
  };

  return (
    <div className="mt-5">
      <h3>Bulk Upload Story (PDF + ZIP)</h3>
      <form onSubmit={upload}>
        <input 
          type="number"
          className="form-control mb-3"
          placeholder="Book ID"
          onChange={e => setBookId(e.target.value)}
        />

        <label>Story PDF</label>
        <input 
          type="file"
          accept="application/pdf"
          className="form-control mb-3"
          onChange={e => setPdf(e.target.files[0])}
        />

        <label>Images ZIP (Scene 1, Scene 2...)</label>
        <input 
          type="file"
          accept=".zip"
          className="form-control mb-3"
          onChange={e => setZip(e.target.files[0])}
        />

        <button className="btn btn-success">Upload Story</button>
      </form>

      {message && <div className="alert alert-info mt-3">{message}</div>}
    </div>
  );
};

export default BulkPDFZipUpload;
