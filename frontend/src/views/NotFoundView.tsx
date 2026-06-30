import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ghost, Home, ArrowLeft } from 'lucide-react';

const NotFoundView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-main)',
      textAlign: 'center',
      padding: '24px'
    }}>
      <div style={{ 
        width: '80px', 
        height: '80px', 
        borderRadius: '50%', 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: '24px',
        border: '1px solid var(--border-color)'
      }}>
        <Ghost size={40} color="var(--text-secondary)" />
      </div>
      
      <h1 style={{ fontSize: '3rem', margin: '0 0 16px 0', fontWeight: 700, letterSpacing: '-1px' }}>404</h1>
      <h2 style={{ fontSize: '1.2rem', margin: '0 0 24px 0', color: 'var(--text-secondary)', fontWeight: 400 }}>
        迷失在显影罐的黑暗中了？
      </h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.6, marginBottom: '40px' }}>
        你似乎访问了一个不存在的页面。可能是链接已失效，或者我们在暗房里把这个页面弄丢了。
      </p>

      <div style={{ display: 'flex', gap: '16px' }}>
        <button 
          className="secondary" 
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <ArrowLeft size={16} /> 返回上页
        </button>
        <button 
          className="primary" 
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <Home size={16} /> 回到首页
        </button>
      </div>
    </div>
  );
};

export default NotFoundView;
