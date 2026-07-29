import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Image, Layers, Wallet } from 'lucide-react';
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
  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="/logo.png" alt="Filmory Logo" />
          <span>Filmory</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn-secondary">登录</Link>
          <Link to="/login" className="btn-primary">免费注册</Link>
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
            胶片记录新版本已上线
          </motion.div>
          <motion.h1 variants={itemVariants}>
            为摄影师打造的<br />
            <span className="text-gradient">极简数字化资产管理</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="hero-subtitle">
            把器材、胶卷、拍摄和花费整理到一个地方。<br/>
            少一点表格和备忘录，多一点专注拍摄本身。
          </motion.p>
          <motion.div variants={itemVariants} className="hero-actions">
            <Link to="/login" className="btn-primary large">
              开始整理拍摄记录 <ArrowRight size={18} />
            </Link>
          </motion.div>
        </motion.div>
        
        {/* Abstract Background Elements */}
        <div className="hero-glow shape-1"></div>
        <div className="hero-glow shape-2"></div>
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
            <div className="feature-icon bg-emerald">
              <Camera size={24} />
            </div>
            <h3>器材使用</h3>
            <p>记住每一台相机、每一支镜头的出勤情况，也把购入价格与维护成本整理清楚。</p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon bg-blue">
              <Image size={24} />
            </div>
            <h3>拍摄归档</h3>
            <p>按胶卷记录、相机、镜头和胶片整理每一次拍摄，把参数、笔记和成片放回同一条记录里。</p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon bg-purple">
              <Layers size={24} />
            </div>
            <h3>胶卷库存</h3>
            <p>从购入、装卷到冲洗，清楚知道每一卷胶片现在在哪里，也不再忘记库存和批次。</p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon bg-amber">
              <Wallet size={24} />
            </div>
            <h3>花费整理</h3>
            <p>器材购入、胶卷消耗、冲洗费用和日常开支集中记录，让摄影预算看得见也理得顺。</p>
          </motion.div>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/logo.png" alt="Filmory Logo" />
            <span>Filmory</span>
          </div>
          <p className="footer-copyright">
            © {new Date().getFullYear()} Filmory · 为认真拍照的人准备的记录工具
          </p>
        </div>
      </footer>
    </div>
  );
};
