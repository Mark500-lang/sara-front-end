import React from "react";

const DataDeletionPolicy = () => {
  return (
    <div className="data-deletion-container text-white">
      <h1>Data Deletion Policy</h1>
      <p>
        At <strong>Sara Stories</strong>, we respect your privacy and provide an
        easy way to request the deletion of your account and associated data.
      </p>

      <h2>How to Request Account Deletion</h2>
      <p>To delete your account, follow these steps:</p>
      <ol>
        <li>Open the Sara Stories app.</li>
        <li>
          Click the message icon on the homepage to open the support modal.
        </li>
        <li>Enter the digits shown in words to verify your request.</li>
        <li>
          Upon correct entry, you will be redirected to compose an email to our
          support team.
        </li>
        <li>Send the email with the subject "Account Deletion Request."</li>
      </ol>

      <h2>What Data is Deleted?</h2>
      <p>
        Once your account is deleted, the following data will be removed
        permanently:
      </p>
      <ul>
        <li>Personal details such as your name and any stored preferences.</li>
        <li>App usage data linked to your account.</li>
      </ul>

      <h2>What Data is Retained?</h2>
      <p>
        Some data may be retained for legal and security purposes, including:
      </p>
      <ul>
        <li>Transaction records (if applicable).</li>
        <li>Anonymous analytics for app improvement.</li>
      </ul>

      <h2>Contact Us</h2>
      <p>
        If you have any questions about data deletion, contact us at:
        <a href="mailto:support@papricut.com">support@papricut.com</a>
      </p>
    </div>
  );
};

export default DataDeletionPolicy;
