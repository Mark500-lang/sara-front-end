import React, { useState } from "react";

const BookUploadForm = () => {
  const [title, setTitle] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [message, setMessage] = useState("");

  const handleBookUpload = async (e) => {
    e.preventDefault();

    if (!title || !coverImage) {
      setMessage("Please fill out all fields.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("cover_image", coverImage);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/books",
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessage(`Book "${data.title}" uploaded successfully!`);
        setTitle("");
        setCoverImage(null);
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (error) {
      setMessage("An error occurred while uploading the book.");
    }
  };

  return (
    <div className="container mt-5">
      <h2>Upload a New Book</h2>
      <form onSubmit={handleBookUpload}>
        <div className="mb-3">
          <label htmlFor="title" className="form-label">
            Book Title
          </label>
          <input
            type="text"
            className="form-control"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="coverImage" className="form-label">
            Cover Image
          </label>
          <input
            type="file"
            className="form-control"
            id="coverImage"
            onChange={(e) => setCoverImage(e.target.files[0])}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Upload Book
        </button>
      </form>
      {message && <div className="mt-3 alert alert-info">{message}</div>}
    </div>
  );
};

export default BookUploadForm;
