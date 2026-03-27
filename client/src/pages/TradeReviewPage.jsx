import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function TradeReviewPage() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const reviewInfo = location.state;

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoggedIn) {
    navigate('/login');
    return null;
  }

  if (!reviewInfo?.transactionItemId || !reviewInfo?.direction) {
    return (
      <>
        <Header showSearch={false} subtitle="Review" />
        <div className="container" style={{ padding: '40px 20px' }}>
          <p>Missing review information.</p>
          <button className="btn btn-primary" onClick={() => navigate('/profile')}>
            Back to Profile
          </button>
        </div>
        <Footer />
      </>
    );
  }

  const handleSubmit = async () => {
    const confirmed = window.confirm(
      'Are you sure? Reviews can only be submitted once and cannot be edited.'
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);

      await api.createTradeReview(
        {
          transactionItemId: reviewInfo.transactionItemId,
          direction: reviewInfo.direction,
          rating: Number(rating),
          comment
        },
        user
      );

      alert('Review submitted successfully.');

      navigate('/profile', {
        state: {
          openTab: reviewInfo.fromTab || 'purchased'
        }
      });
    } catch (error) {
      alert(error.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header showSearch={false} subtitle="Review" />

      <div className="container" style={{ maxWidth: '700px', margin: '40px auto' }}>
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginBottom: '16px' }}>Write a Review</h2>
            <p><strong>Item:</strong> {reviewInfo.title}</p>
            <p><strong>Review for:</strong> {reviewInfo.targetName}</p>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label>Rating</label>
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Okay</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Bad</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Comment</label>
              <textarea
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}