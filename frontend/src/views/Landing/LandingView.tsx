import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Image, Layers, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useLanguage } from '../../contexts/useLanguage';
import { LANGUAGE_OPTIONS, type LanguageCode } from '../../i18n/translations';
import './LandingView.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as any } }
};

export const LandingView: React.FC = () => {
  const navigate = useNavigate();
  const { startTrial } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const handleStartTrial = () => {
    startTrial();
    navigate('/dashboard');
  };

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="/logo.png" alt="Grainfolio Logo" />
          <span>Grainfolio</span>
        </div>
        <div className="landing-nav-actions">
          <div className="landing-language-switch" aria-label={t('landing.languageSwitch')}>
            {LANGUAGE_OPTIONS.map(option => (
              <button
                key={option.code}
                type="button"
                className={language === option.code ? 'active' : ''}
                onClick={() => setLanguage(option.code as LanguageCode)}
                aria-pressed={language === option.code}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost-trial" onClick={handleStartTrial}>
            {t('landing.trial')}
          </button>
          <Link to="/login" className="btn-secondary">{t('landing.login')}</Link>
          <Link to="/login?mode=signup" className="btn-primary">{t('landing.signup')}</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <motion.div 
          className="hero-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="hero-badge">
            <span className="pulse-dot"></span>
            {t('landing.badge')}
          </motion.div>
          <motion.h1 variants={itemVariants}>
            {t('landing.titleLine1')}<br />
            <span className="hero-title-accent">{t('landing.titleHighlight')}</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="hero-subtitle">
            {t('landing.subtitleLine1')}<br/>
            {t('landing.subtitleLine2')}
          </motion.p>
          <motion.div variants={itemVariants} className="hero-actions">
            <button type="button" className="btn-primary large" onClick={handleStartTrial}>
              {t('landing.tryNow')} <ArrowRight size={18} />
            </button>
            <Link to="/login?mode=signup" className="btn-secondary large">
              {t('landing.saveLongTerm')}
            </Link>
          </motion.div>
        </motion.div>
        
      </section>

      {/* Features Grid */}
      <section className="landing-features">
        <motion.div 
          className="features-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          {/* Feature 1 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon">
              <Camera size={24} />
            </div>
            <h3>{t('landing.featureGearTitle')}</h3>
            <p>{t('landing.featureGearCopy')}</p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon">
              <Image size={24} />
            </div>
            <h3>{t('landing.featureArchiveTitle')}</h3>
            <p>{t('landing.featureArchiveCopy')}</p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon">
              <Layers size={24} />
            </div>
            <h3>{t('landing.featureStockTitle')}</h3>
            <p>{t('landing.featureStockCopy')}</p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon">
              <Wallet size={24} />
            </div>
            <h3>{t('landing.featureFinanceTitle')}</h3>
            <p>{t('landing.featureFinanceCopy')}</p>
          </motion.div>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/logo.png" alt="Grainfolio Logo" />
            <span>Grainfolio</span>
          </div>
          <p className="footer-copyright">
            © {new Date().getFullYear()} Grainfolio · {t('landing.footerCopy')}
          </p>
        </div>
      </footer>
    </div>
  );
};
