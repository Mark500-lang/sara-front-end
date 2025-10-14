import React, { useState } from "react";

const PageUploadForm = () => {
  const [bookId, setBookId] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [words, setWords] = useState("");
  const [pageImage, setPageImage] = useState(null);
  const [message, setMessage] = useState("");

  const handlePageUpload = async (e) => {
    e.preventDefault();

    if (!bookId || !pageNumber || !words || !pageImage) {
      setMessage("Please fill out all fields.");
      return;
    }

    const formData = new FormData();
    formData.append("page_number", pageNumber);
    formData.append("words", words);
    formData.append("image", pageImage);

    try {
      const response = await fetch(
        `https://kithia.com/website_b5d91c8e/api/books/${bookId}/pages`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessage(`Page ${data.page_number} uploaded successfully!`);
        setPageNumber("");
        setWords("");
        setPageImage(null);
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (error) {
      setMessage("An error occurred while uploading the page.");
    }
  };

  return (
    <div className="container mt-5">
      <h2>Upload a New Page</h2>
      <form onSubmit={handlePageUpload}>
        <div className="mb-3">
          <label htmlFor="bookId" className="form-label">
            Book ID
          </label>
          <input
            type="text"
            className="form-control"
            id="bookId"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
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
          />
        </div>
        <div className="mb-3">
          <label htmlFor="words" className="form-label">
            Words
          </label>
          <textarea
            className="form-control"
            id="words"
            rows="3"
            value={words}
            onChange={(e) => setWords(e.target.value)}
          ></textarea>
        </div>
        <div className="mb-3">
          <label htmlFor="pageImage" className="form-label">
            Page Image
          </label>
          <input
            type="file"
            className="form-control"
            id="pageImage"
            onChange={(e) => setPageImage(e.target.files[0])}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Upload Page
        </button>
      </form>
      {message && <div className="mt-3 alert alert-info">{message}</div>}
    </div>
  );
};

export default PageUploadForm;
