import React from "react";
import BookUploadForm from "./BookUploadForm";
import PageUploadForm from "./PageUploadForm";
import AudioUploadForm from "./AudioUploadForm";
import BulkPDFZipUpload from "./BulkPDFZipUpload";

const AdminDashboard = () => {
  return (
    <div className="container mt-5">
      <h1>Admin Dashboard</h1>
      <BookUploadForm />
      <hr />
      < BulkPDFZipUpload />
      <hr />
      <PageUploadForm />
      <hr />
      <AudioUploadForm />
    </div>
  );
};

export default AdminDashboard;
