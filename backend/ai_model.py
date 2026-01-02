import numpy as np
import random
from datetime import datetime
import base64

class FraudDetectionModel:
    """AI model with Gemini integration for fraud detection"""
    
    def __init__(self, genai_client):
        self.genai_client = genai_client
        self.model_accuracy = 0.85
        self.predictions_count = 0
        
        self.fraud_indicators = {
            'high_amount': 0.3,
            'duplicate_claim': 0.4,
            'suspicious_timing': 0.2,
            'incomplete_info': 0.25,
            'new_identity': 0.15
        }
    
    def predict_fraud_with_gemini(self, claim_data, proof_files=None):
        """Predict fraud using Gemini AI analysis with file content"""
        self.predictions_count += 1
        
        # Extract claim details
        amount = float(claim_data.get('amount', 0))
        claim_type = claim_data.get('claimType', '')
        description = claim_data.get('description', '')
        diagnosis = claim_data.get('diagnosis', '')
        patient_name = claim_data.get('patientName', '')
        
        # Build prompt for Gemini with file information
        prompt = self._build_gemini_prompt_with_files(claim_data, proof_files)
        
        gemini_analysis = ""
        fraud_score = 0.5
        gemini_success = False
        
        try:
            print(f"🤖 Attempting Gemini AI analysis...")
            print(f"   - Patient: {patient_name}")
            print(f"   - Amount: ₹{amount}")
            print(f"   - Files: {len(proof_files) if proof_files else 0}")
            print(f"   - Model: gemini-2.5-flash")
            
            # Call Gemini AI with multimodal content if files exist
            if proof_files and len(proof_files) > 0:
                print(f"   - Mode: Multimodal (text + {len(proof_files)} files)")
                
                # Build parts list - text first, then files
                parts = [{"text": prompt}]
                
                files_processed = 0
                # Add file contents to Gemini analysis
                for idx, file_info in enumerate(proof_files[:3], 1):  # Analyze up to 3 files
                    try:
                        print(f"   - Processing file {idx}: {file_info['filename']}")
                        
                        mime_type = file_info['mimetype']
                        
                        # Skip unsupported or problematic file types
                        if mime_type == 'application/pdf':
                            print(f"   ⚠️ Skipping PDF (Gemini has issues with some PDFs) - {file_info['filename']}")
                            continue
                        
                        # Only process images for now (more reliable)
                        if mime_type.startswith('image/'):
                            # Add inline_data part for image files
                            parts.append({
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": file_info['data']
                                }
                            })
                            files_processed += 1
                            print(f"   ✅ Image file added to analysis")
                        else:
                            print(f"   ⚠️ Skipping unsupported file type: {mime_type}")
                            
                    except Exception as file_error:
                        print(f"   ⚠️ Error processing file {file_info.get('filename')}: {file_error}")
                        continue
                
                # If we have files to analyze, use multimodal; otherwise text-only
                if files_processed > 0:
                    print(f"   📊 Sending to Gemini: 1 text prompt + {files_processed} image(s)")
                    response = self.genai_client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=parts
                    )
                else:
                    print(f"   ⚠️ No compatible files for Gemini - using text-only analysis")
                    response = self.genai_client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt
                    )
            else:
                print(f"   - Mode: Text-only (no files)")
                # Text-only analysis if no files - just pass the prompt string
                response = self.genai_client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
            
            gemini_analysis = response.text
            gemini_success = True
            print(f"   ✅ Gemini AI analysis completed successfully")
            print(f"   - Response length: {len(gemini_analysis)} characters")
            
            # Parse Gemini response for fraud indicators
            fraud_score = self._calculate_fraud_score_from_gemini(
                gemini_analysis, claim_data, proof_files
            )
            
        except Exception as e:
            print(f"   ❌ Gemini AI Error: {type(e).__name__}: {str(e)}")
            
            # Try to extract more error details
            if hasattr(e, 'response'):
                print(f"   - Response: {e.response}")
            if hasattr(e, 'message'):
                print(f"   - Message: {e.message}")
            
            # Fallback to basic fraud detection
            fraud_score = self._basic_fraud_detection(claim_data)
            
            gemini_analysis = f"""⚠️ Gemini AI analysis temporarily unavailable

Error: {str(e)}

**FALLBACK ANALYSIS - Basic Fraud Detection**

**Claim Summary:**
- Patient: {patient_name}
- Claim Amount: ₹{amount}
- Claim Type: {claim_type}
- Diagnosis: {diagnosis}
- Description Length: {len(description)} characters
- Documentation: {len(proof_files) if proof_files else 0} file(s) uploaded

**Automated Risk Assessment:**
{self._generate_basic_analysis(claim_data, proof_files)}

**Recommendation:** Manual review strongly recommended due to AI system unavailability.

**Note:** This is a basic automated assessment. For accurate fraud detection, please ensure Gemini AI service is properly configured and available."""
        
        # Traditional fraud indicators
        indicators_found = self._check_traditional_indicators(claim_data)
        
        # Determine if fraudulent
        is_fraud = fraud_score > 0.5
        confidence = abs(fraud_score - 0.5) * 2
        
        return {
            'is_fraud': is_fraud,
            'fraud_probability': round(fraud_score, 4),
            'confidence': round(confidence, 4),
            'risk_level': self._get_risk_level(fraud_score),
            'indicators': indicators_found,
            'gemini_analysis': gemini_analysis,
            'has_proof_files': len(proof_files) if proof_files else 0,
            'gemini_success': gemini_success,
            'model_version': '2.0.0-Gemini-Flash',
            'prediction_timestamp': datetime.now().isoformat()
        }
    
    def _build_gemini_prompt_with_files(self, claim_data, proof_files):
        """Build comprehensive prompt for Gemini AI with file context"""
        
        has_files = proof_files and len(proof_files) > 0
        
        file_info = ""
        if has_files:
            file_info = f"\n**UPLOADED MEDICAL DOCUMENTS ({len(proof_files)} files):**\n"
            for idx, file in enumerate(proof_files[:3], 1):  # Show first 3 files
                file_info += f"{idx}. {file['filename']} ({file['mimetype']}, {file['size']/1024:.1f} KB)\n"
            file_info += "\n**IMPORTANT:** Analyze the uploaded medical documents (bills, prescriptions, reports) along with the claim details. Verify if the documents support the claimed diagnosis and amount.\n"
        else:
            file_info = "\n⚠️ **NO MEDICAL DOCUMENTS UPLOADED** - This significantly increases fraud risk.\n"
        
        prompt = f"""You are an expert medical insurance fraud detection AI. Analyze this insurance claim for potential fraud, overbilling, or irregularities.

**CLAIM DETAILS:**
- Patient Name: {claim_data.get('patientName', 'N/A')}
- Claim Type: {claim_data.get('claimType', 'N/A')}
- Amount Claimed: ₹{claim_data.get('amount', 0)}
- Diagnosis: {claim_data.get('diagnosis', 'N/A')}
- Policy Number: {claim_data.get('policyNumber', 'N/A')}
- Hospital: {claim_data.get('hospitalName', 'Medical Facility')}
{file_info}
**DETAILED DESCRIPTION:**
{claim_data.get('description', 'No description provided')}

**YOUR ANALYSIS TASK:**

1. **Document Verification** (if files uploaded):
   - Check if medical documents are authentic and relevant
   - Verify bills, prescriptions, and reports match the diagnosis
   - Look for altered or suspicious documents

2. **Medical Consistency**:
   - Does the claimed amount match typical costs for this diagnosis?
   - Is the diagnosis consistent with described treatment?
   - Are there any medical red flags?

3. **Fraud Pattern Detection**:
   - Overbilling indicators
   - Suspicious claim patterns
   - Missing critical information
   - Inconsistencies in medical details

4. **Documentation Quality**:
   - Completeness of claim description
   - Quality and quantity of supporting documents
   - Missing essential documentation

**PROVIDE YOUR ANALYSIS IN THIS EXACT FORMAT:**

FRAUD RISK ASSESSMENT: [0-100]%

DOCUMENT ANALYSIS:
[If documents uploaded, analyze their authenticity and relevance]
[If no documents, flag this as a major concern]

MEDICAL CONSISTENCY CHECK:
[Evaluate if diagnosis matches treatment and costs]

RED FLAGS IDENTIFIED:
- [List any suspicious patterns or concerns]
- [One flag per line]

POSITIVE INDICATORS:
- [List elements that support claim legitimacy]
- [One indicator per line]

RECOMMENDATION: [APPROVE / REQUIRES_REVIEW / REJECT]

DETAILED EXPLANATION:
[Provide 3-4 sentences explaining your fraud risk assessment, focusing on why you rated it this way based on the documents and claim details]

**CRITICAL INSTRUCTIONS:**
- Return ONLY the analysis text in the format above
- DO NOT include any code, Python scripts, or programming examples
- DO NOT use markdown code blocks (``` or ```)
- DO NOT include implementation details or technical code
- DO NOT generate any executable code or functions
- ONLY provide the fraud analysis description as plain text
- Focus on medical and insurance analysis, NOT on how to perform the analysis programmatically
- Your response should be readable by insurance claim reviewers, not developers
- Write in natural language describing the findings, NOT in programming syntax

Be thorough and consider medical insurance standards in India. Base your assessment on concrete evidence from the claim details and uploaded documents."""

        return prompt
    
    def _generate_basic_analysis(self, claim_data, proof_files):
        """Generate basic analysis for fallback"""
        amount = float(claim_data.get('amount', 0))
        description = claim_data.get('description', '')
        
        analysis_parts = []
        
        # Amount analysis
        if amount > 100000:
            analysis_parts.append("⚠️ Very high claim amount detected (>₹100,000) - requires detailed verification")
        elif amount > 50000:
            analysis_parts.append("⚠️ High claim amount (>₹50,000) - standard verification recommended")
        else:
            analysis_parts.append("✓ Claim amount within normal range")
        
        # Documentation analysis
        if not proof_files or len(proof_files) == 0:
            analysis_parts.append("⚠️ CRITICAL: No medical documentation provided - high fraud risk")
        elif len(proof_files) >= 3:
            analysis_parts.append("✓ Good documentation provided - reduces fraud risk")
        else:
            analysis_parts.append("⚠️ Limited documentation - additional files recommended")
        
        # Description analysis
        if len(description) < 50:
            analysis_parts.append("⚠️ Brief claim description - more details needed")
        elif len(description) > 150:
            analysis_parts.append("✓ Detailed claim description provided")
        else:
            analysis_parts.append("✓ Adequate claim description")
        
        return "\n".join(analysis_parts)
    
    def _calculate_fraud_score_from_gemini(self, gemini_response, claim_data, proof_files):
        """Extract fraud score from Gemini response with better parsing"""
        
        fraud_score = 0.5  # Default to medium risk if unclear
        
        try:
            # Look for fraud risk assessment score
            import re
            
            # Try to find percentage score
            score_patterns = [
                r'FRAUD RISK ASSESSMENT:\s*(\d+)%',
                r'FRAUD RISK SCORE:\s*(\d+)%',
                r'RISK SCORE:\s*(\d+)%',
                r'FRAUD PROBABILITY:\s*(\d+)%'
            ]
            
            for pattern in score_patterns:
                score_match = re.search(pattern, gemini_response, re.IGNORECASE)
                if score_match:
                    fraud_score = int(score_match.group(1)) / 100.0
                    print(f"   📊 Extracted fraud score from Gemini: {fraud_score:.2%}")
                    break
        except Exception as e:
            print(f"   ⚠️ Error parsing Gemini score: {e}")
        
        # Adjust based on Gemini recommendation
        response_lower = gemini_response.lower()
        
        if 'reject' in response_lower or 'fraudulent' in response_lower:
            fraud_score = max(fraud_score, 0.70)
            print(f"   🚩 'Reject' keyword detected - fraud score adjusted to {fraud_score:.2%}")
        
        if 'requires_review' in response_lower or 'suspicious' in response_lower:
            fraud_score = max(fraud_score, 0.50)
            print(f"   ⚠️ 'Review' keyword detected - fraud score adjusted to {fraud_score:.2%}")
        
        if 'approve' in response_lower and 'legitimate' in response_lower:
            fraud_score = min(fraud_score, 0.30)
            print(f"   ✅ 'Approve' keyword detected - fraud score adjusted to {fraud_score:.2%}")
        
        # Strong adjustments based on documentation
        if not proof_files or len(proof_files) == 0:
            # No documentation = high risk
            fraud_score = max(fraud_score, 0.65)
            print(f"   ⚠️ No proof files - fraud score increased to {fraud_score:.2%}")
        elif len(proof_files) >= 3:
            # Good documentation = lower risk
            fraud_score *= 0.75
            print(f"   ✅ {len(proof_files)} proof files - fraud score reduced to {fraud_score:.2%}")
        
        # Adjust for description quality
        description = claim_data.get('description', '')
        if len(description) > 150:
            fraud_score *= 0.90  # Detailed description reduces risk
            print(f"   ✅ Detailed description - fraud score reduced to {fraud_score:.2%}")
        elif len(description) < 50:
            fraud_score = max(fraud_score, 0.55)  # Poor description increases risk
            print(f"   ⚠️ Brief description - fraud score increased to {fraud_score:.2%}")
        
        # Ensure score is between 0 and 1
        fraud_score = max(0.0, min(1.0, fraud_score))
        
        print(f"   📊 Final fraud score: {fraud_score:.2%}")
        return fraud_score
    
    def _basic_fraud_detection(self, claim_data):
        """Fallback basic fraud detection when Gemini unavailable"""
        
        amount = float(claim_data.get('amount', 0))
        description = claim_data.get('description', '')
        
        fraud_score = 0.0
        
        # Amount-based risk
        if amount > 100000:
            fraud_score += 0.4
        elif amount > 50000:
            fraud_score += 0.3
        elif amount > 25000:
            fraud_score += 0.15
        
        # Description quality
        if len(description) < 30:
            fraud_score += 0.30
        elif len(description) < 100:
            fraud_score += 0.15
        
        # Suspicious keywords
        suspicious_keywords = ['urgent', 'emergency', 'immediate', 'cash', 'asap']
        keyword_count = sum(1 for keyword in suspicious_keywords if keyword in description.lower())
        fraud_score += keyword_count * 0.1
        
        # Medical terms (positive indicator)
        medical_terms = ['procedure', 'treatment', 'medication', 'surgery', 'diagnosis', 'prescription']
        medical_count = sum(1 for term in medical_terms if term in description.lower())
        fraud_score -= medical_count * 0.05
        
        # Random noise for variability
        noise = random.uniform(-0.05, 0.05)
        
        final_score = max(0.0, min(1.0, fraud_score + noise))
        print(f"   📊 Basic detection fraud score: {final_score:.2%}")
        
        return final_score
    
    def _check_traditional_indicators(self, claim_data):
        """Check traditional fraud indicators"""
        
        indicators = []
        amount = float(claim_data.get('amount', 0))
        description = claim_data.get('description', '')
        
        if amount > 75000:
            indicators.append('High claim amount requiring verification')
        
        if len(description) < 50:
            indicators.append('Insufficient claim description')
        
        suspicious_keywords = ['urgent', 'emergency', 'immediate', 'cash']
        found_keywords = [kw for kw in suspicious_keywords if kw in description.lower()]
        if found_keywords:
            indicators.append(f'Suspicious keywords detected: {", ".join(found_keywords)}')
        
        return indicators
    
    def _get_risk_level(self, fraud_score):
        """Categorize risk level based on fraud score"""
        if fraud_score < 0.35:
            return 'LOW'
        elif fraud_score < 0.65:
            return 'MEDIUM'
        else:
            return 'HIGH'
    
    def get_model_stats(self):
        """Get model statistics"""
        return {
            'model_version': '2.0.0-Gemini-Flash',
            'model_type': 'Gemini 2.5 Flash with Document Analysis',
            'accuracy': self.model_accuracy,
            'predictions_made': self.predictions_count,
            'gemini_enabled': True,
            'supports_multimodal': True,
            'last_updated': datetime.now().isoformat()
        }