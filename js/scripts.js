document.addEventListener("DOMContentLoaded", () => {
  console.log("Automait LLC - Futuristic Edition Loaded");

  // Particles.js for AI Neurons
  particlesJS('particles-js', {
    particles: {
      number: { value: 50, density: { enable: true, value_area: 800 } },
      color: { value: ['#f093fb', '#f5576c', '#00f5ff'] },
      shape: { type: 'circle' },
      opacity: { value: 0.5, random: true },
      size: { value: 3, random: true },
      line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.4, width: 1 },
      move: { enable: true, speed: 2, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false }
    },
    interactivity: {
      detect_on: 'canvas',
      events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
      modes: { grab: { distance: 140, line_linked: { opacity: 1 } }, push: { particles_nb: 4 } }
    },
    retina_detect: true
  });

  // Custom Cursor
  const cursor = document.querySelector('.custom-cursor');
  document.addEventListener('mousemove', e => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });
  document.querySelectorAll('a, button, .nav-link').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
  // AI Demo Chat Toggle & Simulation
  const demoToggles = document.querySelectorAll('#demo-toggle, #demo-toggle-secondary');
  const aiChat = document.getElementById('ai-chat');
  const chatInput = document.getElementById('chat-input');

  demoToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      aiChat.classList.toggle('active');
    });
  });

  chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      const userMsg = document.createElement('div');
      userMsg.classList.add('chat-message', 'user-message');
      userMsg.textContent = chatInput.value;
      aiChat.insertBefore(userMsg, chatInput);
      
      // Simulate AI response based on niches
      setTimeout(() => {
        const aiMsg = document.createElement('div');
        aiMsg.classList.add('chat-message', 'ai-message');
        const query = chatInput.value.toLowerCase();
        let response = "Automating that for you... Done! Efficiency boosted.";
        if (query.includes('chatbot')) {
          response = "Building a custom AI chatbot for your support needs. Integrated with Grok for natural conversations!";
        } else if (query.includes('content')) {
          response = "Generating SEO-optimized content using Claude. Ready to boost your marketing!";
        } else if (query.includes('data')) {          response = "Analyzing your data with ChatGPT. Insights delivered in real-time!";
        }
        aiMsg.textContent = response;
        aiChat.insertBefore(aiMsg, chatInput);
        aiChat.scrollTop = aiChat.scrollHeight;
      }, 1000);

      chatInput.value = '';
    }
  });

  // Parallax Scrolling for Spheres
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.gradient-sphere').forEach((sphere, index) => {
      const speed = (index + 1) * 0.2;
      sphere.style.transform = `translateY(${window.scrollY * speed}px)`;
    });
  });
});