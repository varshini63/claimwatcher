import React, { useState, useEffect } from 'react';
import { getClaims } from '../../services/api';
import { approveClaimOnChain, rejectClaimOnChain } from '../../services/blockchain';
import './ClaimsManagement.css';

function ClaimsManagement() {
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filter, searchTerm, claims]);

  const fetchClaims = async () => {
    try {
      const response = await getClaims();
      console.log('✅ Insurance claims (filtered by policy ownership):', response.data);
      setClaims(response.data);
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...claims];

    if (filter !== 'all') {
      if (filter === 'flagged') {
        filtered = filtered.filter(claim => claim.aiDecision === 'FLAGGED');
      } else {
        filtered = filtered.filter(claim => claim.status === filter.toUpperCase());
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(claim => 
        claim.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.patientName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredClaims(filtered);
  };

  const handleApprove = async (claimId) => {
    if (!window.confirm('Are you sure you want to approve this claim? This will create a blockchain transaction.')) {
      return;
    }

    setProcessing(claimId);
    setMessage('');

    try {
      setMessage('🦊 Please confirm the transaction in MetaMask...');
      
      const txResult = await approveClaimOnChain(claimId);

      if (txResult.success) {
        const gasUsed = Number(txResult.tx.gasUsed);
        const effectiveGasPrice = txResult.tx.effectiveGasPrice ? Number(txResult.tx.effectiveGasPrice) : 20000000000;
        const gasCost = (gasUsed * effectiveGasPrice) / 1e18;
        
        setMessage(`✅ Claim approved on blockchain!\n` +
                   `Transaction: ${txResult.tx.transactionHash.substring(0, 10)}...\n` +
                   `Gas Used: ${gasUsed}\n` +
                   `Cost: ${gasCost.toFixed(6)} ETH`);
        
        setTimeout(() => {
          fetchClaims();
          setMessage('');
        }, 2000);
      } else {
        setMessage(`❌ Transaction failed: ${txResult.error}`);
      }
    } catch (error) {
      if (error.code === 4001) {
        setMessage('❌ Transaction rejected by user');
      } else {
        setMessage(`❌ Error: ${error.message}`);
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (claimId) => {
    if (!window.confirm('Are you sure you want to reject this claim? This will create a blockchain transaction.')) {
      return;
    }

    setProcessing(claimId);
    setMessage('');

    try {
      setMessage('🦊 Please confirm the transaction in MetaMask...');
      
      const txResult = await rejectClaimOnChain(claimId);

      if (txResult.success) {
        const gasUsed = Number(txResult.tx.gasUsed);
        const effectiveGasPrice = txResult.tx.effectiveGasPrice ? Number(txResult.tx.effectiveGasPrice) : 20000000000;
        const gasCost = (gasUsed * effectiveGasPrice) / 1e18;
        
        setMessage(`✅ Claim rejected on blockchain!\n` +
                   `Transaction: ${txResult.tx.transactionHash.substring(0, 10)}...\n` +
                   `Gas Used: ${gasUsed}\n` +
                   `Cost: ${gasCost.toFixed(6)} ETH`);
        
        setTimeout(() => {
          fetchClaims();
          setMessage('');
        }, 2000);
      } else {
        setMessage(`❌ Transaction failed: ${txResult.error}`);
      }
    } catch (error) {
      if (error.code === 4001) {
        setMessage('❌ Transaction rejected by user');
      } else {
        setMessage(`❌ Error: ${error.message}`);
      }
    } finally {
      setProcessing(null);
    }
  };

  const formatAmount = (amount) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? '0' : num.toLocaleString('en-IN');
  };

  const viewClaimDetails = (claim) => {
    setSelectedClaim(claim);
  };

  const closeModal = () => {
    setSelectedClaim(null);
  };

  const downloadFile = (fileData) => {
    try {
      const byteCharacters = atob(fileData.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileData.mimetype });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Unable to download file');
    }
  };

  const countFlaggedClaims = () => {
    return claims.filter(c => c.aiDecision === 'FLAGGED').length;
  };

  const getFraudTypeBadgeClass = (fraudType) => {
    if (!fraudType || fraudType === 'UNKNOWN' || fraudType === 'HIDDEN') return 'info';
    if (fraudType === 'NO_FRAUD') return 'success';
    if (fraudType === 'OVERBILLING' || fraudType === 'EXAGGERATION') return 'warning';
    return 'error';
  };

  const getFraudTypeDisplay = (fraudType) => {
    if (!fraudType || fraudType === 'UNKNOWN') return 'UNKNOWN';
    if (fraudType === 'HIDDEN') return 'HIDDEN';
    return fraudType.replace(/_/g, ' ');
  };

  if (loading) {
    return <div className="loading">Loading claims from blockchain...</div>;
  }

  return (
    <div className="claims-management">
      <h2>Claims Management</h2>
      <p className="subtitle">Review claims for YOUR policies only (blockchain-filtered)</p>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : message.includes('🦊') ? 'info' : 'error'}`}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{message}</pre>
        </div>
      )}

      <div className="controls-bar">
        <div className="filters">
          <button 
            className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('all')}
          >
            All ({claims.length})
          </button>
          <button 
            className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending ({claims.filter(c => c.status === 'PENDING').length})
          </button>
          <button 
            className={filter === 'approved' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('approved')}
          >
            ✅ Approved ({claims.filter(c => c.status === 'APPROVED').length})
          </button>
          <button 
            className={filter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('rejected')}
          >
            ❌ Rejected ({claims.filter(c => c.status === 'REJECTED').length})
          </button>
          <button 
            className={filter === 'flagged' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('flagged')}
          >
            🚩 AI Flagged ({countFlaggedClaims()})
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by claim # or patient name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredClaims.length === 0 ? (
        <div className="empty-state">
          <p>
            {filter === 'all' 
              ? 'No claims found for your policies. Claims will appear here when hospitals submit them against policies you issued.'
              : `No ${filter} claims found for your policies.`}
          </p>
        </div>
      ) : (
        <div className="claims-grid">
          {filteredClaims.map((claim) => {
            const proofFiles = claim.proofFiles || [];
            const geminiAnalysis = claim.geminiAnalysis || '';
            const aiDecision = claim.aiDecision || 'PENDING';
            const mlFraudType = claim.mlFraudType || 'UNKNOWN';
            const mlConfidence = claim.mlConfidence || 0;
            
            return (
              <div key={claim.id} className="claim-card">
                <div className="claim-header">
                  <div>
                    <h4>Claim #{claim.claimNumber}</h4>
                    <span className="claim-type">{claim.claimType}</span>
                  </div>
                  <span className={`status-badge ${
                    claim.status === 'APPROVED' ? 'success' : 
                    claim.status === 'REJECTED' ? 'error' : 
                    'pending'
                  }`}>
                    {claim.status === 'APPROVED' && '✅ '}
                    {claim.status === 'REJECTED' && '❌ '}
                    {claim.status === 'PENDING' && '⏳ '}
                    {claim.status}
                  </span>
                </div>

                <div className="claim-details">
                  <div className="detail-row">
                    <span>Patient:</span>
                    <strong>{claim.patientName}</strong>
                  </div>
                  
                  <div className="detail-row highlight">
                    <span>Claim Amount:</span>
                    <strong className="amount">₹{formatAmount(claim.amount)}</strong>
                  </div>

                  <div className="detail-row">
                    <span>Hospital:</span>
                    <span>{claim.hospitalName}</span>
                  </div>

                  <div className="detail-row">
                    <span>Policy Number:</span>
                    <span>{claim.policyNumber}</span>
                  </div>

                  <div className="detail-row">
                    <span>Diagnosis:</span>
                    <span>{claim.diagnosis}</span>
                  </div>

                  <div className="detail-row">
                    <span>📎 Medical Documents:</span>
                    <strong>{proofFiles.length} file(s) uploaded</strong>
                  </div>

                  <div className="detail-row">
                    <span>🤖 AI Decision:</span>
                    <span className={`ai-badge ${
                      aiDecision === 'APPROVED' ? 'success' : 
                      aiDecision === 'FLAGGED' ? 'warning' : 
                      'info'
                    }`}>
                      {aiDecision === 'APPROVED' && '✅ '}
                      {aiDecision === 'FLAGGED' && '🚩 '}
                      {aiDecision}
                    </span>
                  </div>

                  {mlFraudType !== 'HIDDEN' && (
                    <>
                      <div className="detail-row">
                        <span>🎯 ML Fraud Type:</span>
                        <span className={`fraud-type-badge ${getFraudTypeBadgeClass(mlFraudType)}`}>
                          {getFraudTypeDisplay(mlFraudType)}
                        </span>
                      </div>

                      <div className="detail-row">
                        <span>📊 ML Confidence:</span>
                        <strong>{mlConfidence}%</strong>
                      </div>
                    </>
                  )}

                  <div className="detail-row">
                    <span>Submitted:</span>
                    <span>{new Date(claim.submittedAt).toLocaleString()}</span>
                  </div>
                </div>

                {geminiAnalysis && (
                  <div className="gemini-preview">
                    <strong>🤖 Gemini AI Analysis Preview:</strong>
                    <p>{geminiAnalysis.substring(0, 200)}...</p>
                  </div>
                )}

                {(aiDecision === 'FLAGGED' || (mlFraudType !== 'NO_FRAUD' && mlFraudType !== 'UNKNOWN' && mlFraudType !== 'HIDDEN')) && claim.status === 'PENDING' && (
                  <div className="fraud-alert">
                    🚩 <strong>AI Alert:</strong> This claim has been flagged
                    {mlFraudType !== 'UNKNOWN' && mlFraudType !== 'HIDDEN' && mlFraudType !== 'NO_FRAUD' && ` as potential ${getFraudTypeDisplay(mlFraudType)}`}.
                    Check medical documents and AI analysis before approval.
                  </div>
                )}

                <button 
                  className="view-details-btn"
                  onClick={() => viewClaimDetails(claim)}
                >
                  📋 View Full Analysis & Documents
                </button>

                {claim.status === 'PENDING' && (
                  <div className="claim-actions">
                    <button 
                      className="approve-btn"
                      onClick={() => handleApprove(claim.id)}
                      disabled={processing === claim.id}
                    >
                      {processing === claim.id ? '🔄 Processing...' : '✅ Approve (Gas Fee)'}
                    </button>
                    <button 
                      className="reject-btn"
                      onClick={() => handleReject(claim.id)}
                      disabled={processing === claim.id}
                    >
                      {processing === claim.id ? '🔄 Processing...' : '❌ Reject (Gas Fee)'}
                    </button>
                  </div>
                )}

                {claim.status !== 'PENDING' && (
                  <div className="blockchain-info">
                    <p className="blockchain-note">
                      🔒 This decision is permanently recorded on the blockchain
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedClaim && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            
            <h3>Claim Details - #{selectedClaim.claimNumber}</h3>
            
            <div className="modal-section">
              <h4>Patient Information</h4>
              <p><strong>Name:</strong> {selectedClaim.patientName}</p>
              <p><strong>Hospital:</strong> {selectedClaim.hospitalName}</p>
              <p><strong>Policy:</strong> {selectedClaim.policyNumber}</p>
            </div>

            <div className="modal-section">
              <h4>Claim Information</h4>
              <p><strong>Type:</strong> {selectedClaim.claimType}</p>
              <p><strong>Amount:</strong> ₹{formatAmount(selectedClaim.amount)}</p>
              <p><strong>Diagnosis:</strong> {selectedClaim.diagnosis}</p>
              <p><strong>Description:</strong></p>
              <p className="description-text">{selectedClaim.description || 'No description provided'}</p>
            </div>

            {selectedClaim.mlFraudType && selectedClaim.mlFraudType !== 'HIDDEN' && (
              <div className="modal-section">
                <h4>🤖 Machine Learning Fraud Type Prediction</h4>
                <div className="ml-prediction-box">
                  <p><strong>Predicted Fraud Type:</strong> 
                    <span className={`fraud-type-badge ${getFraudTypeBadgeClass(selectedClaim.mlFraudType)}`}>
                      {getFraudTypeDisplay(selectedClaim.mlFraudType)}
                    </span>
                  </p>
                  <p><strong>Model Confidence:</strong> {selectedClaim.mlConfidence}%</p>
                  
                  {selectedClaim.mlFraudType !== 'NO_FRAUD' && selectedClaim.mlFraudType !== 'UNKNOWN' && (
                    <div className="ml-warning">
                      ⚠️ <strong>ML Model Alert:</strong> This claim has been flagged as 
                      potential {getFraudTypeDisplay(selectedClaim.mlFraudType).toLowerCase()}. 
                      Please review carefully before approval.
                    </div>
                  )}
                  
                  <p className="ml-note">
                    💡 The ML model uses Random Forest algorithm trained on historical claims 
                    to classify fraud types based on patient demographics, diagnosis, treatment, and billing amount.
                  </p>
                </div>
              </div>
            )}

            {selectedClaim.geminiAnalysis && (
              <div className="modal-section">
                <h4>🤖 Gemini AI Complete Fraud Analysis</h4>
                <pre className="gemini-full-analysis">{selectedClaim.geminiAnalysis}</pre>
              </div>
            )}

            <div className="modal-section">
              <h4>📎 Uploaded Medical Documents ({(selectedClaim.proofFiles || []).length})</h4>
              {(selectedClaim.proofFiles || []).length > 0 ? (
                <div className="files-list">
                  {selectedClaim.proofFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-icon">📄</span>
                      <div className="file-info">
                        <strong>{file.filename}</strong>
                        <small>{(file.size / 1024).toFixed(2)} KB • {file.mimetype}</small>
                      </div>
                      <button 
                        className="download-btn"
                        onClick={() => downloadFile(file)}
                      >
                        ⬇️ Download
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-files">⚠️ No documents uploaded with this claim (High fraud risk)</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="summary-box">
        <h4>📊 Claims Summary (Your Policies Only)</h4>
        <div className="summary-stats">
          <div>
            <strong>{claims.length}</strong>
            <span>Total Claims</span>
          </div>
          <div>
            <strong>{claims.filter(c => c.status === 'APPROVED').length}</strong>
            <span>Approved</span>
          </div>
          <div>
            <strong>{claims.filter(c => c.status === 'PENDING').length}</strong>
            <span>Pending Review</span>
          </div>
          <div>
            <strong>{claims.filter(c => c.status === 'REJECTED').length}</strong>
            <span>Rejected</span>
          </div>
          <div>
            <strong>{countFlaggedClaims()}</strong>
            <span>Flagged by AI</span>
          </div>
          <div>
            <strong>₹{formatAmount(claims.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + (typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount), 0))}</strong>
            <span>Total Approved</span>
          </div>
        </div>
      </div>

      <div className="info-box">
        <h4>🔗 Blockchain Data Privacy</h4>
        <ul>
          <li>✅ You only see claims for policies YOU issued</li>
          <li>✅ Claims are automatically filtered by blockchain verification</li>
          <li>✅ No other insurance company can see your claims</li>
          <li>✅ All approvals/rejections are permanently recorded on blockchain</li>
          <li>✅ ML fraud type predictions stored immutably on blockchain</li>
        </ul>
      </div>

      <div className="info-box">
        <h4>🤖 Dual AI Fraud Detection System</h4>
        <ul>
          <li>🎯 <strong>ML Model:</strong> Predicts specific fraud types (Overbilling, Fake Claims, etc.)</li>
          <li>🧠 <strong>Gemini AI:</strong> Provides detailed analysis of medical documents and claim details</li>
          <li>📊 <strong>Combined Score:</strong> Both AI systems work together for accurate detection</li>
          <li>🔒 <strong>Blockchain Storage:</strong> All predictions permanently recorded</li>
        </ul>
      </div>
    </div>
  );
}

export default ClaimsManagement;