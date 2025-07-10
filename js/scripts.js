// Modern JavaScript for 0tomAIt
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add parallax effect to gradient spheres
    const spheres = document.querySelectorAll('.gradient-sphere');
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX / window.innerWidth - 0.5;
        mouseY = e.clientY / window.innerHeight - 0.5;
        
        spheres.forEach((sphere, index) => {
            const speed = (index + 1) * 0.02;
            const x = mouseX * speed * 100;
            const y = mouseY * speed * 100;
            
            sphere.style.transform = `translate(${x}px, ${y}px)`;
        });
    });

    // Intersection Observer for animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.style.animationPlayState = 'paused';
        card.style.animation = 'slideUp 0.8s ease-out';
        observer.observe(card);
    });

    // Dynamic header background on scroll
    const header = document.querySelector('header');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            header.classList.add('scrolled');
            header.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            header.classList.remove('scrolled');
            header.style.background = 'var(--glass-bg)';
        }
        
        lastScroll = currentScroll;
    });

    // Typing effect for hero subtitle
    const brandHighlight = document.querySelector('.brand-highlight');
    if (brandHighlight) {
        const text = brandHighlight.textContent;
        brandHighlight.textContent = '';
        let i = 0;
        
        const typeWriter = () => {
            if (i < text.length) {
                brandHighlight.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            }
        };
        
        setTimeout(typeWriter, 1000);
    }

    // Add hover effect to tech items
    document.querySelectorAll('.tech-item').forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Animated counter for metrics
    const animateValue = (element, start, end, duration) => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value + (element.dataset.suffix || '');
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };

    // Trigger counter animation when metrics come into view
    const metricObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                const value = entry.target.textContent;
                if (value === '99%') {
                    entry.target.dataset.suffix = '%';
                    animateValue(entry.target, 0, 99, 2000);
                } else if (value === '$99') {
                    entry.target.dataset.suffix = '';
                    entry.target.textContent = '$';
                    animateValue(entry.target, 0, 99, 2000);
                }
                entry.target.classList.add('animated');
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.metric-value').forEach(metric => {
        metricObserver.observe(metric);
    });

    // Add ripple effect to buttons
    document.querySelectorAll('.cta-button').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            this.appendChild(ripple);
            
            const x = e.clientX - e.target.offsetLeft;
            const y = e.clientY - e.target.offsetTop;
            
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// Add ripple animation CSS dynamically
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        width: 0;
        height: 0;
        background: rgba(255, 255, 255, 0.5);
        transform: translate(-50%, -50%);
        animation: rippleEffect 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes rippleEffect {
        to {
            width: 200px;
            height: 200px;
            opacity: 0;
        }
    }
    
    .visible {
        opacity: 1 !important;
    }
`;
document.head.appendChild(style);