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
            v2.0 纯本地优先架构上线
          </motion.div>
          <motion.h1 variants={itemVariants}>
            为摄影师打造的<br />
            <span className="text-gradient">极简数字化资产管理</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="hero-subtitle">
            本地优先、数据主权、硬核财务流追踪。<br/>
            抛弃笨重的管理方式，找回最纯粹的胶片记录体验。
          </motion.p>
          <motion.div variants={itemVariants} className="hero-actions">
            <Link to="/login" className="btn-primary large">
              开启工作台 <ArrowRight size={18} />
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
            <h3>设备统计</h3>
            <p>追踪每一台相机与镜头的出勤率。记录购买价格与维护成本，为您计算精准的防潮箱资产估值与使用性价比。</p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon bg-blue">
              <Image size={24} />
            </div>
            <h3>拍摄记录</h3>
            <p>结构化地归档每一次快门。支持记录光圈、快门、焦段及冲洗配方，为您呈现完美的时间流照片墙与精美相册。</p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon bg-purple">
              <Layers size={24} />
            </div>
            <h3>库存统计</h3>
            <p>从购入胶卷、装机开拍到最终冲洗，全流程跟踪胶片库存。支持各种型号的底片备忘与评级，告别混乱的耗材管理。</p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div className="feature-card" variants={itemVariants}>
            <div className="feature-icon bg-amber">
              <Wallet size={24} />
            </div>
            <h3>资金总结</h3>
            <p>像专业会计一样管理摄影开支。多维度图表解析器材买卖、胶片燃烧及冲洗费用，让每一笔花销都有迹可循。</p>
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
            © {new Date().getFullYear()} Filmory Workspace. Built with precision and passion.
          </p>
        </div>
      </footer>
    </div>
  );
};
