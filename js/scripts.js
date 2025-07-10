// 0tomait - Modern AI Business Automation Platform Scripts
document.addEventListener('DOMContentLoaded', () => {
  console.log('0tomait - AI Business Automation Platform Loaded');

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Navbar background on scroll
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.style.background = 'rgba(0, 0, 0, 0.95)';
      nav.style.backdropFilter = 'blur(30px)';
    } else {
      nav.style.background = 'rgba(0, 0, 0, 0.7)';
      nav.style.backdropFilter = 'blur(20px)';
    }
  });

  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      mobileMenuToggle.classList.toggle('active');
    });
  }

  // Intersection Observer for animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        
        // Add stagger effect for feature cards
        if (entry.target.classList.contains('feature-card')) {
          const cards = document.querySelectorAll('.feature-card');
          cards.forEach((card, index) => {
            setTimeout(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, index * 100);
          });
        }
      }
    });
  }, observerOptions);

  // Observe elements for animation
  const animatedElements = document.querySelectorAll('.feature-card, .process-step, .trusted-logo');
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
  });

  // Parallax effect for gradient background
  const gradientBg = document.querySelector('.gradient-bg');
  if (gradientBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const parallax = scrolled * 0.5;
      gradientBg.style.transform = `translateY(${parallax}px)`;
    });
  }

  // Counter animation for metrics
  const animateCounter = (element, start, end, duration) => {
    const startTime = performance.now();
    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(progress * (end - start) + start);
      
      if (element.textContent.includes('%')) {
        element.textContent = current + '%';
      } else if (element.textContent.includes('x')) {
        element.textContent = current + 'x';
      } else if (element.textContent.includes('+')) {
        element.textContent = current + '+';
      } else {
        element.textContent = current.toString();
      }
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };
    requestAnimationFrame(updateCounter);
  };

  // Observe metric values for counter animation
  const metricObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
        entry.target.classList.add('animated');
        const text = entry.target.textContent;
        const number = parseInt(text.match(/\d+/)[0]);
        animateCounter(entry.target, 0, number, 1500);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.metric-value').forEach(metric => {
    metricObserver.observe(metric);
  });

  // Workflow nodes hover effect
  const workflowNodes = document.querySelectorAll('.workflow-node');
  workflowNodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      workflowNodes.forEach(n => {
        if (n !== node) {
          n.style.opacity = '0.5';
        }
      });
    });
    
    node.addEventListener('mouseleave', () => {
      workflowNodes.forEach(n => {
        n.style.opacity = '1';
      });
    });
  });

  // CTA button ripple effect
  const ctaButtons = document.querySelectorAll('.cta-button');
  ctaButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // Add ripple styles dynamically
  const style = document.createElement('style');
  style.textContent = `
    .cta-button {
      position: relative;
      overflow: hidden;
    }
    .ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      transform: scale(0);
      animation: ripple-animation 0.6s ease-out;
      pointer-events: none;
    }
    @keyframes ripple-animation {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Typing effect for hero subtitle
  const heroSubtitle = document.querySelector('.hero-subtitle');
  if (heroSubtitle) {
    const text = heroSubtitle.textContent;
    heroSubtitle.textContent = '';
    let index = 0;
    
    const typeWriter = () => {
      if (index < text.length) {
        heroSubtitle.textContent += text.charAt(index);
        index++;
        setTimeout(typeWriter, 20);
      }
    };
    
    // Start typing after a delay
    setTimeout(typeWriter, 800);
  }

  // Add hover effect for feature cards
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px) rotateX(5deg)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) rotateX(0)';
    });
  });

  // Dynamic gradient animation on mouse move
  document.addEventListener('mousemove', (e) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    const gradientBg = document.querySelector('.gradient-bg');
    if (gradientBg) {
      gradientBg.style.background = `
        radial-gradient(circle at ${x * 100}% ${y * 100}%, var(--primary-glow) 0%, transparent 50%),
        radial-gradient(circle at ${(1 - x) * 100}% ${(1 - y) * 100}%, var(--accent) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, #ff35c5 0%, transparent 50%)
      `;
    }
  });

  // Form submission handling (for future contact forms)
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Add form submission logic here
      console.log('Form submitted');
    });
  });

  // Page load animation sequence
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });
});