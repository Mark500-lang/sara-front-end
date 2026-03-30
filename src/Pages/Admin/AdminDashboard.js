import React from "react";
import BookUploadForm from "./BookUploadForm";
import PageUploadForm from "./PageUploadForm";
import AudioUploadForm from "./AudioUploadForm";
import BulkPDFZipUpload from "./BulkPDFZipUpload";
import BulkAudioUploadForm from "./BulkAudioUploadForm";

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
      <hr />
      <BulkAudioUploadForm />
    </div>
  );
};

export default AdminDashboard;
