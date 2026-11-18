import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useAuth } from '../auth/AuthContext';
import { ViMascotImage } from '../components/ViMascotImage';
import { VI_APP_ICON } from '../constants/mascot';
import { attachSagePointerEffects } from '../utils/interactiveEffects';
import './LandingPage.css';

interface HeroWord {
  word: string;
  ipa: string;
  pos: string;
  cefr: string;
  srsNote: string;
  meaningVi: string;
  example: string;
  exampleVi: string;
}

const HERO_WORDS: HeroWord[] = [
  {
    word: 'serendipity',
    ipa: '/ˌser.ənˈdɪp.ə.ti/',
    pos: 'danh từ',
    cefr: 'Oxford 5000 · C1',
    srsNote: 'Ôn mốc 7 ngày',
    meaningVi: 'Cơ duyên tình cờ tìm thấy điều quý giá khi không chủ đích kiếm tìm.',
    example: 'Meeting my mentor at that small bookshop was pure serendipity.',
    exampleVi: 'Gặp người cố vấn tại hiệu sách nhỏ đó là một cơ duyên tình cờ.',
  },
  {
    word: 'resilient',
    ipa: '/rɪˈzɪl.jənt/',
    pos: 'tính từ',
    cefr: 'Oxford 3000 · B2',
    srsNote: 'Ôn mốc 3 ngày',
    meaningVi: 'Kiên cường, có khả năng phục hồi nhanh sau thử thách.',
    example: 'She remained resilient throughout the toughest months of building her startup.',
    exampleVi: 'Cô ấy vẫn kiên cường trong những tháng khó khăn nhất khi khởi nghiệp.',
  },
  {
    word: 'eloquent',
    ipa: '/ˈel.ə.kwənt/',
    pos: 'tính từ',
    cefr: 'Oxford 5000 · C1',
    srsNote: 'Ôn mốc 14 ngày',
    meaningVi: 'Hùng biện, diễn đạt trôi chảy và giàu sức thuyết phục.',
    example: 'Her eloquent presentation convinced the entire committee.',
    exampleVi: 'Bài thuyết trình đầy sức thuyết phục của cô ấy đã chinh phục cả hội đồng.',
  },
  {
    word: 'articulate',
    ipa: '/ɑːˈtɪk.jə.leɪt/',
    pos: 'động từ / tính từ',
    cefr: 'Oxford 5000 · C1',
    srsNote: 'Ôn mốc 30 ngày',
    meaningVi: 'Diễn đạt rõ ràng, mạch lạc từng ý tưởng phức tạp.',
    example: 'He can articulate complex ideas in simple, natural English.',
    exampleVi: 'Anh ấy có thể diễn đạt các ý tưởng phức tạp bằng tiếng Anh tự nhiên.',
  },
];

const CEFR_DATA: Record<'A1' | 'B1' | 'B2' | 'C1', { word: string; desc: string }> = {
  A1: { word: 'morning', desc: '/ˈmɔː.nɪŋ/ · Buổi sáng khởi đầu nhẹ nhàng' },
  B1: { word: 'collaborate', desc: '/kəˈlæb.ə.reɪt/ · Hợp tác cùng nhau trong công việc' },
  B2: { word: 'resilient', desc: '/rɪˈzɪl.jənt/ · Kiên cường, phục hồi nhanh sau thử thách' },
  C1: { word: 'serendipity', desc: '/ˌser.ənˈdɪp.ə.ti/ · Cơ duyên tìm thấy điều quý giá' },
};

const MARQUEE_QUOTES = [
  { quote: '“Nhờ mốc ôn 1–3–7–14–30 ngày, mình không còn học trước quên sau.”', author: 'Minh Anh · B2' },
  { quote: '“AI Coach Vi chấm 5 tiêu chí phát âm rất sát, biết ngay mình sai âm đuôi nào.”', author: 'Hoàng Nam · C1' },
  { quote: '“Mở Dashboard chỉ có một hàng đợi duy nhất, vào là học ngay không rối.”', author: 'Thảo Vy · B1' },
];

const FAQ_ITEMS = [
  {
    q: 'Vòng lặp Học → Ôn → Nói diễn ra trong bao lâu mỗi ngày?',
    a: 'Chỉ khoảng 10–15 phút. Hàng đợi trên trang Tổng quan tự động gom từ mới, thẻ SRS đến hạn (1–3–7–14–30 ngày) và bài luyện nói vào một luồng liền mạch.',
  },
  {
    q: 'AI Coach “Vi” chấm điểm nói như thế nào?',
    a: 'Whisper chuyển giọng nói của bạn thành văn bản, sau đó AI Coach “Vi” chấm điểm trên 5 tiêu chí: Grammar, Vocabulary, Fluency, Content và Pronunciation.',
  },
  {
    q: 'Thanh toán gói Premium 99.000đ/tháng qua đâu?',
    a: 'Thanh toán trực tiếp bằng mã QR ngân hàng qua cổng PayOS và kích hoạt tự động ngay sau vài giây.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ctaLink = user ? '/dashboard' : '/login';

  const [isNavigating, setIsNavigating] = useState(false);
  const [wordIdx, setWordIdx] = useState(0);
  const [manualFlipped, setManualFlipped] = useState(false);
  const [scrollFlipDeg, setScrollFlipDeg] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loopStep, setLoopStep] = useState(0);
  const [cefrLevel, setCefrLevel] = useState<'A1' | 'B1' | 'B2' | 'C1'>('A1');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const heroStageRef = useRef<HTMLElement>(null);
  const mistLayerRef = useRef<HTMLDivElement>(null);
  const loopSectionRef = useRef<HTMLElement>(null);

  const activeWord = HERO_WORDS[wordIdx];

  // Cycle hero Oxford word every 4 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      setWordIdx((prev) => (prev + 1) % HERO_WORDS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  // Pointer specular glint & <= 5deg tilt on hero flashcard + scene parallax
  useEffect(() => attachSagePointerEffects(), []);

  // Lenis + GSAP ScrollTrigger on ONE requestAnimationFrame loop (scrub: 0.5)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);

    const ctx = gsap.context(() => {
      if (heroStageRef.current) {
        ScrollTrigger.create({
          trigger: heroStageRef.current,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * 0.5)}`,
          scrub: 0.5,
          onUpdate: (self) => {
            const p = Math.max(0, Math.min(1, self.progress));
            setScrollFlipDeg(p * 180);
            if (mistLayerRef.current) {
              mistLayerRef.current.style.setProperty('--hero-mist-opacity', (1 - p * 0.65).toFixed(2));
            }
          },
        });
      }

      if (loopSectionRef.current) {
        ScrollTrigger.create({
          trigger: loopSectionRef.current,
          start: 'top 60%',
          end: 'bottom 45%',
          scrub: 0.5,
          onUpdate: (self) => {
            const p = self.progress;
            if (p < 0.34) setLoopStep(0);
            else if (p < 0.68) setLoopStep(1);
            else setLoopStep(2);
          },
        });
      }
    }, rootRef);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      ctx.revert();
      lenis.destroy();
    };
  }, []);

  // Scroll-reveal Observer for .enter-y
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.landing-page .enter-y'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-inview'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-inview');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handlePronounce = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsSpeaking((s) => !s);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(activeWord.word);
        u.lang = 'en-US';
        u.rate = 0.92;
        u.onstart = () => setIsSpeaking(true);
        u.onend = () => setIsSpeaking(false);
        u.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch {
        setIsSpeaking((s) => !s);
      }
    },
    [activeWord.word]
  );

  const handlePrimaryNavigate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isNavigating) return;
    setIsNavigating(true);
    window.setTimeout(() => {
      window.scrollTo(0, 0);
      navigate(ctaLink);
    }, 180);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const totalFlipDeg = manualFlipped ? Math.max(180, scrollFlipDeg + 180) : scrollFlipDeg;

  return (
    <div ref={rootRef} className={`landing-page ${isNavigating ? 'page-exiting' : ''}`}>
      <div className="landing-paper-grain" aria-hidden="true" />

      {/* 1. Floating Glass Pill Navbar */}
      <header className="landing-nav-host">
        <nav aria-label="Điều hướng chính" className="landing-nav glass">
          <a href="#hero" className="landing-brand" onClick={(e) => scrollToSection(e, 'hero')}>
            <img
              src={VI_APP_ICON.file}
              alt={VI_APP_ICON.alt}
              width={32}
              height={32}
            />
            <span>
              Vocabulary<em>AI</em>
            </span>
          </a>

          <div className="landing-nav-links">
            <a href="#loop" onClick={(e) => scrollToSection(e, 'loop')}>Vòng lặp</a>
            <a href="#library" onClick={(e) => scrollToSection(e, 'library')}>Thư viện</a>
            <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')}>Học phí</a>
            <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')}>FAQ</a>
          </div>

          <div
            className="landing-streak-pill"
            title="Daily Streak — Màu Amber #c9862f duy nhất cho Streak & Premium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.5 2C13.5 2 15.8 5.2 14.4 8.4C13.8 9.8 12.1 10.6 12.1 10.6C12.1 10.6 13.4 8.2 11.4 6.5C9.5 4.8 7 7.1 6.3 9.7C5.4 13.1 7.1 17.5 11.2 18.6C8.8 17 8.8 14.3 10.1 12.9C11.2 11.7 12.6 12.3 13.4 13.7C14.1 14.9 13.8 17.2 12.4 18.7C16.7 18.3 19.3 14.5 18.3 10.2C17.6 7.1 13.5 2 13.5 2Z" />
            </svg>
            <span>14 ngày</span>
          </div>
        </nav>
      </header>

      {/* 2. HERO — "SÂN KHẤU THƯ VIỆN KÍNH" */}
      <section id="hero" ref={heroStageRef} className="hero-stage">
        <div className="hero-scene-bg scene-depth" aria-hidden="true">
          <div className="hero-arch a" />
          <div className="hero-arch b" />
          <div className="hero-arch c" />
          <div ref={mistLayerRef} className="hero-mist-layer">
            <div className="hero-mist m1" />
            <div className="hero-mist m2" />
            <div className="hero-mist m3" />
          </div>
        </div>

        {/* Giant Outlined Ghost Word matching active card word */}
        <div className="hero-ghost-word" aria-hidden="true">
          {activeWord.word}
        </div>

        <div className="landing-wrap hero-grid">
          {/* Left: Asymmetric Editorial Headline & THE Single Primary CTA */}
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              <span>Không gian học từ vựng khép kín cho người Việt</span>
            </div>

            <h1 className="hero-headline">
              <span className="hero-line-mask">
                <span className="hero-line-inner" style={{ '--line-i': 0 } as React.CSSProperties}>
                  Nhớ từ đúng lúc.
                </span>
              </span>
              <span className="hero-line-mask">
                <span className="hero-line-inner" style={{ '--line-i': 1 } as React.CSSProperties}>
                  Nói <em className="hero-serif-word">chuẩn</em> tự nhiên.
                </span>
              </span>
            </h1>

            <p className="hero-sub">
              Học từ trong ngữ cảnh, ôn tập với SRS ngay trước khi quên và luyện nói cùng trợ lý AI{' '}
              <strong>“Vi”</strong> trong một hàng đợi duy nhất mỗi ngày.
            </p>

            {/* THE SINGLE PRIMARY CTA ON THE LANDING PAGE */}
            <div className="hero-cta-row">
              <Link
                to={ctaLink}
                id="primary-cta-main"
                className="hero-primary-cta"
                onClick={handlePrimaryNavigate}
              >
                <span>Bắt đầu học miễn phí</span>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <span className="hero-cta-note">
                Có gói Free 0đ · Premium 99.000đ/tháng
              </span>
            </div>
          </div>

          {/* Right of center: Tilted 6-Layer Glass Flashcard + 2 Satellite Glass Cards + Vi happy-wave */}
          <div className="hero-card-stage">
            <div className="hero-satellite hero-satellite-score glass" aria-hidden="true">
              <div className="hero-sat-eyebrow">SPEAKING · 5 TIÊU CHÍ</div>
              <div className="hero-sat-value">94 điểm</div>
              <div className="hero-sat-sub">Whisper + Vi AI đánh giá</div>
            </div>

            <div className="hero-satellite hero-satellite-quiz glass" aria-hidden="true">
              <div className="hero-sat-eyebrow">TIMED QUIZ · B2</div>
              <div className="hero-sat-value">✓ Chính xác</div>
              <div className="hero-sat-sub">Nhớ sâu trong 12 giây</div>
            </div>

            <div className="hero-flip-perspective">
              <div
                className="hero-glass-flashcard tilt-target"
                data-tilt-max="5"
                role="button"
                tabIndex={0}
                aria-label={`Thẻ từ ${activeWord.word} — nhấn hoặc cuộn để lật xem nghĩa`}
                style={{ '--scroll-flip': `${totalFlipDeg}deg` } as React.CSSProperties}
                onClick={() => setManualFlipped((f) => !f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setManualFlipped((f) => !f);
                  }
                }}
              >
                {/* Front Face */}
                <div className="hero-card-face glass">
                  <div className="hero-card-top">
                    <span className="hero-card-cefr">{activeWord.cefr}</span>
                    <span className="hero-card-srs">{activeWord.srsNote}</span>
                  </div>

                  <div>
                    <h2 className="hero-word-title">{activeWord.word}</h2>
                    <p className="hero-word-ipa">
                      {activeWord.ipa} · {activeWord.pos}
                    </p>
                    <p className="hero-word-meaning">“{activeWord.meaningVi}”</p>
                  </div>

                  <div>
                    <div className="hero-card-dots" style={{ marginBottom: 12 }}>
                      {HERO_WORDS.map((item, idx) => (
                        <button
                          key={item.word}
                          type="button"
                          aria-label={`Xem từ ${item.word}`}
                          className={`hero-card-dot ${idx === wordIdx ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setWordIdx(idx);
                          }}
                        />
                      ))}
                    </div>

                    <div className={`hero-voice-bar ${isSpeaking ? 'is-speaking' : ''}`}>
                      <button
                        type="button"
                        className="hero-mic-btn"
                        onClick={handlePronounce}
                      >
                        <span className="hero-eyebrow-dot" style={{ background: 'var(--sage)' }} />
                        <span>{isSpeaking ? 'Vi đang đọc...' : 'Thử phát âm cùng Vi'}</span>
                      </button>

                      <div className="hero-wave-bars" aria-hidden="true">
                        <span className="hero-wave-bar" style={{ height: 11, animationDelay: '0ms' }} />
                        <span className="hero-wave-bar" style={{ height: 16, animationDelay: '120ms' }} />
                        <span className="hero-wave-bar" style={{ height: 9, animationDelay: '240ms' }} />
                        <span className="hero-wave-bar" style={{ height: 14, animationDelay: '90ms' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back Face (scrubbed at 50vh scroll) */}
                <div className="hero-card-face hero-card-face--back glass">
                  <div className="hero-card-top">
                    <span className="hero-card-cefr">NGỮ CẢNH &amp; NGHĨA TIẾNG VIỆT</span>
                    <span className="hero-card-srs">{activeWord.cefr}</span>
                  </div>

                  <div>
                    <h2 className="hero-word-title" style={{ fontSize: 28 }}>
                      {activeWord.word}
                    </h2>
                    <p className="hero-word-meaning" style={{ fontWeight: 700, color: 'var(--sage)' }}>
                      {activeWord.meaningVi}
                    </p>
                    <p className="hero-word-meaning" style={{ fontSize: 13.5, fontStyle: 'italic' }}>
                      “{activeWord.example}”
                    </p>
                    <p className="hero-word-ipa" style={{ marginTop: 6 }}>
                      {activeWord.exampleVi}
                    </p>
                  </div>

                  <div className="hero-voice-bar">
                    <span className="hero-card-srs">Nhấn hoặc cuộn lên để xem mặt trước ↻</span>
                  </div>
                </div>
              </div>

              <div className="hero-vi-mascot">
                <ViMascotImage
                  pose="happy-wave"
                  size={98}
                  priority
                  alt="Vi mascot — vẫy tay chào bạn trên sân khấu thư viện kính"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Editorial Stats Row */}
        <div className="landing-wrap">
          <div className="hero-editorial-stats">
            <div className="hero-stat-item">
              <span className="hero-stat-value">4.900+ từ Oxford 3000/5000</span>
              <span className="hero-stat-label">Từ vựng chọn lọc kèm IPA &amp; ví dụ thực tế</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">CEFR A1 – C1</span>
              <span className="hero-stat-label">Xếp lớp thông minh sau bài Placement Test</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">SRS 1–3–7–14–30 ngày</span>
              <span className="hero-stat-label">Nhắc ôn đúng điểm rơi trước khi quên</span>
            </div>
          </div>
        </div>
      </section>

      <div className="hero-seam" aria-hidden="true" />

      {/* 3. THE CORE LOOP SECTION (Học → Ôn → Nói) */}
      <section id="loop" ref={loopSectionRef} className="landing-section">
        <div className="landing-wrap">
          <div className="landing-section-head enter-y">
            <p className="landing-eyebrow">Một vòng lặp khép kín</p>
            <h2 className="landing-h2">
              Ba nhịp tự nhiên để một từ vựng thật sự thuộc về bạn.
            </h2>
          </div>

          <div className="landing-loop-grid">
            <div className="landing-loop-tabs" role="tablist" aria-label="Ba bước Học Ôn Nói">
              <button
                type="button"
                role="tab"
                aria-selected={loopStep === 0}
                className={`loop-tab-btn glass ${loopStep === 0 ? 'is-active' : ''}`}
                onClick={() => setLoopStep(0)}
              >
                <div className="loop-tab-meta">
                  <span>01 · Học (Learn)</span>
                  <span>Oxford 3000/5000</span>
                </div>
                <h3 className="loop-tab-title">Hiểu từ ngay trong ngữ cảnh</h3>
                <p className="loop-tab-desc">
                  Đọc câu thực tế và nghe AI Coach “Vi” giải thích sắc thái ngắn gọn.
                </p>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={loopStep === 1}
                className={`loop-tab-btn glass ${loopStep === 1 ? 'is-active' : ''}`}
                onClick={() => setLoopStep(1)}
              >
                <div className="loop-tab-meta">
                  <span>02 · Ôn (Review)</span>
                  <span>1 – 3 – 7 – 14 – 30 ngày</span>
                </div>
                <h3 className="loop-tab-title">Lặp lại ngay trước khi quên</h3>
                <p className="loop-tab-desc">
                  Thẻ nhớ SRS tự động xuất hiện đúng điểm rơi của trí nhớ.
                </p>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={loopStep === 2}
                className={`loop-tab-btn glass ${loopStep === 2 ? 'is-active' : ''}`}
                onClick={() => setLoopStep(2)}
              >
                <div className="loop-tab-meta">
                  <span>03 · Nói (Speak)</span>
                  <span>Whisper + Gemini</span>
                </div>
                <h3 className="loop-tab-title">Mở lời và nhận điểm 5 tiêu chí</h3>
                <p className="loop-tab-desc">
                  Nhận diện giọng nói chuẩn xác, sửa phát âm và ngữ pháp tức thì.
                </p>
              </button>
            </div>

            <div className="glass loop-canvas-card">
              <div className="loop-canvas-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="hero-eyebrow-dot" style={{ background: 'var(--sage)' }} />
                  <strong>Hàng đợi Tổng quan (Dashboard Queue)</strong>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--sage)' }}>
                  Bước 0{loopStep + 1} / 03
                </span>
              </div>

              {loopStep === 0 && (
                <div className="loop-stage-view" key="loop-0">
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700 }}>
                        resilient
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 10 }}>
                        /rɪˈzɪl.jənt/ · B2
                      </span>
                    </div>
                    <span className="tag">Kiên cường</span>
                  </div>
                  <p className="loop-quote-box">
                    “She remained <strong style={{ fontStyle: 'normal', color: 'var(--sage)' }}>resilient</strong> throughout the toughest months of building her startup.”
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <ViMascotImage pose="explain" size={44} alt="Vi giải thích ngữ cảnh từ resilient" />
                    <span>
                      <strong>AI Coach Vi:</strong> Thường đi cùng <em>remain / stay resilient</em> để chỉ sức bật tinh thần.
                    </span>
                  </div>
                </div>
              )}

              {loopStep === 1 && (
                <div className="loop-stage-view" key="loop-1">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Chu kỳ ghi nhớ dài hạn (SRS)</span>
                    <strong style={{ color: 'var(--sage)' }}>Độ lưu giữ: 95%</strong>
                  </div>
                  <div className="loop-srs-grid">
                    {[
                      { day: '1', label: 'ngày', cls: '' },
                      { day: '3', label: 'ngày', cls: '' },
                      { day: '7', label: 'hôm nay', cls: 'is-today' },
                      { day: '14', label: 'ngày', cls: 'is-future' },
                      { day: '30', label: 'ngày', cls: 'is-future' },
                    ].map((node) => (
                      <div key={node.day} className={`loop-srs-node ${node.cls}`}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>{node.day}</div>
                        <div style={{ fontSize: 11 }}>{node.label}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
                    Hệ thống tự động gọi lại thẻ từ ngay trước điểm rơi quên lãng, kết hợp bài kiểm tra nhanh (Timed Quizzes).
                  </p>
                </div>
              )}

              {loopStep === 2 && (
                <div className="loop-stage-view" key="loop-2">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 'var(--r-md)',
                      background: 'rgba(250, 248, 241, 0.8)',
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontStyle: 'italic' }}>
                      “Staying <strong style={{ fontStyle: 'normal', color: 'var(--sage)' }}>resilient</strong> helps me speak English with confidence.”
                    </span>
                    <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 24, color: 'var(--sage)' }}>
                      92/100
                    </strong>
                  </div>
                  <div className="loop-srs-grid">
                    {[
                      ['Grammar', 94],
                      ['Vocabulary', 92],
                      ['Fluency', 89],
                      ['Content', 95],
                      ['Pronunciation', 90],
                    ].map(([label, score]) => (
                      <div key={label} className="loop-srs-node is-future" style={{ color: 'var(--ink)' }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 700 }}>{score}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                    Whisper chuyển giọng nói thành chữ; AI Coach <strong>Vi</strong> chấm điểm chi tiết trên 5 tiêu chí.
                  </p>
                </div>
              )}

              <div className="loop-progress-track">
                <div className="loop-progress-fill" style={{ width: `${((loopStep + 1) / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MINIMAL 3-CARD BENTO GRID + INFINITE MARQUEE */}
      <section id="library" className="landing-section landing-section--bordered">
        <div className="landing-wrap">
          <div className="landing-section-head enter-y">
            <p className="landing-eyebrow">Thư viện tinh gọn</p>
            <h2 className="landing-h2">
              Đủ sâu để nhớ lâu, đủ thoáng để học mỗi ngày.
            </h2>
          </div>

          <div className="landing-bento-grid">
            {/* Bento 1: Oxford Level Switcher */}
            <div className="glass landing-bento-card enter-y">
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage)' }}>Oxford 3000 / 5000</span>
                <h3 style={{ fontSize: 22, marginTop: 4 }}>4.900+ từ theo chuẩn CEFR</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  Làm Placement Test đầu vào để nhận lộ trình cá nhân hóa từ A1 đến C1.
                </p>
                <div className="cefr-pills-row">
                  {(['A1', 'B1', 'B2', 'C1'] as const).map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      className={`cefr-pill-btn ${cefrLevel === lv ? 'active' : ''}`}
                      onClick={() => setCefrLevel(lv)}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ paddingTop: 14, borderTop: '1px solid rgba(34, 48, 31, 0.1)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700 }}>
                  {CEFR_DATA[cefrLevel].word}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {CEFR_DATA[cefrLevel].desc}
                </div>
              </div>
            </div>

            {/* Bento 2: AI Coach Vi */}
            <div className="glass landing-bento-card enter-y">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage)' }}>Trợ lý AI “Vi”</span>
                    <h3 style={{ fontSize: 22, marginTop: 4 }}>Trò chuyện &amp; sửa ngữ pháp</h3>
                  </div>
                  <ViMascotImage pose="explain" size={50} alt="Vi giải thích ngữ pháp" />
                </div>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0' }}>
                  Hỏi nghĩa từ, luyện phản xạ hội thoại và được sửa từng lỗi nhỏ tự nhiên như người bản xứ.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
                <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(250, 248, 241, 0.8)' }}>
                  “I very like learning new words in context.”
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(71, 96, 63, 0.12)' }}>
                  <strong style={{ color: 'var(--sage)' }}>Vi gợi ý:</strong> “I <strong>really</strong> like learning new words in context.”
                </div>
              </div>
            </div>

            {/* Bento 3: Daily Streak */}
            <div className="glass landing-bento-card enter-y">
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Nhịp học đều đặn</span>
                <h3 style={{ fontSize: 22, marginTop: 4 }}>Giữ lửa chuỗi ngày học</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  Chỉ 10 phút mỗi ngày trên một hàng đợi duy nhất để duy trì thói quen bền vững.
                </p>
              </div>
              <div style={{ paddingTop: 14, borderTop: '1px solid rgba(34, 48, 31, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--amber)' }}>
                    14 ngày
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Chuỗi học liên tiếp (Daily Streak)</div>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'var(--cream)',
                    border: '1px solid rgba(201, 134, 47, 0.35)',
                    color: 'var(--amber)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M13.5 2C13.5 2 15.8 5.2 14.4 8.4C13.8 9.8 12.1 10.6 12.1 10.6C12.1 10.6 13.4 8.2 11.4 6.5C9.5 4.8 7 7.1 6.3 9.7C5.4 13.1 7.1 17.5 11.2 18.6C8.8 17 8.8 14.3 10.1 12.9C11.2 11.7 12.6 12.3 13.4 13.7C14.1 14.9 13.8 17.2 12.4 18.7C16.7 18.3 19.3 14.5 18.3 10.2C17.6 7.1 13.5 2 13.5 2Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Infinite Marquee */}
          <div className="landing-marquee-shell">
            <div className="landing-marquee-track">
              {[...MARQUEE_QUOTES, ...MARQUEE_QUOTES].map((item, idx) => (
                <div key={idx} className="glass landing-marquee-item">
                  <span style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', color: 'var(--sage)', fontSize: 14.5 }}>
                    {item.quote}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>— {item.author}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. PRICING SECTION */}
      <section id="pricing" className="landing-section landing-section--bordered">
        <div className="landing-wrap">
          <div className="landing-section-head landing-section-head--center enter-y">
            <p className="landing-eyebrow">Học phí minh bạch</p>
            <h2 className="landing-h2">Khởi đầu miễn phí, nâng cấp khi sẵn sàng.</h2>
          </div>

          <div className="landing-pricing-grid">
            <div className="glass landing-price-card enter-y">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 22, margin: 0 }}>Gói Free</h3>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Trọn đời</span>
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="landing-price-val">0đ</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ tháng</span>
                </div>
                <ul className="landing-price-list">
                  <li><span style={{ color: 'var(--sage)', fontWeight: 700 }}>✓</span><span>Placement Test &amp; lộ trình cá nhân hóa</span></li>
                  <li><span style={{ color: 'var(--sage)', fontWeight: 700 }}>✓</span><span>Học từ Oxford 3000/5000 &amp; ôn SRS mỗi ngày</span></li>
                  <li><span style={{ color: 'var(--sage)', fontWeight: 700 }}>✓</span><span>Lượt luyện nói cơ bản cùng AI Coach “Vi”</span></li>
                </ul>
              </div>
              <div style={{ paddingTop: 14, borderTop: '1px solid rgba(34, 48, 31, 0.1)', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--muted)' }}>Không cần thẻ ngân hàng</span>
                <a href="#primary-cta-main" style={{ fontWeight: 700, color: 'var(--sage)' }} onClick={(e) => scrollToSection(e, 'hero')}>
                  Chọn ở đầu trang ↑
                </a>
              </div>
            </div>

            <div className="glass landing-price-card landing-price-card--pro enter-y">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 22, margin: 0, color: 'var(--sage)' }}>Gói Premium</h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 'var(--r-pill)',
                      background: 'var(--amber-bg)',
                      color: 'var(--amber-dark)',
                      border: '1px solid rgba(201, 134, 47, 0.35)',
                    }}
                  >
                    Thanh toán PayOS
                  </span>
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="landing-price-val">99.000đ</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ tháng</span>
                </div>
                <ul className="landing-price-list">
                  <li><span style={{ color: 'var(--sage)', fontWeight: 700 }}>✓</span><span>Mở khóa trọn bộ 4.900+ từ vựng CEFR A1–C1</span></li>
                  <li><span style={{ color: 'var(--sage)', fontWeight: 700 }}>✓</span><span>Luyện nói Whisper &amp; chấm điểm 5 tiêu chí không giới hạn</span></li>
                  <li><span style={{ color: 'var(--sage)', fontWeight: 700 }}>✓</span><span>Trò chuyện &amp; sửa ngữ pháp 24/7 cùng AI Coach “Vi”</span></li>
                </ul>
              </div>
              <div style={{ paddingTop: 14, borderTop: '1px solid rgba(34, 48, 31, 0.1)', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--muted)' }}>Quét QR tự động qua PayOS</span>
                <a href="#primary-cta-main" style={{ fontWeight: 700, color: 'var(--sage)' }} onClick={(e) => scrollToSection(e, 'hero')}>
                  Bắt đầu ngay ↑
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. MINIMAL FAQ & EDITORIAL FOOTER */}
      <section id="faq" className="landing-section landing-section--bordered">
        <div className="landing-wrap">
          <div className="landing-section-head landing-section-head--center enter-y">
            <h2 className="landing-h2" style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}>
              Câu hỏi thường gặp
            </h2>
          </div>

          <div className="landing-faq-list">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className={`glass landing-faq-card ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="landing-faq-btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                  >
                    <span>{item.q}</span>
                    <span className="landing-faq-icon" aria-hidden="true">+</span>
                  </button>
                  <div className="landing-faq-body">
                    <div className="landing-faq-inner">
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={VI_APP_ICON.file}
              alt={VI_APP_ICON.alt}
              width={26}
              height={26}
              style={{ borderRadius: 7 }}
            />
            <strong style={{ color: 'var(--ink)' }}>VocabularyAI</strong>
            <span>· Sage Thư Viện</span>
          </div>

          <div>
            Oxford 3000/5000 (4.900+ từ) · SRS 1–3–7–14–30 ngày · AI Coach Vi
          </div>

          <div className="landing-footer-links">
            <Link to="/dieu-khoan">Điều khoản</Link>
            <Link to="/chinh-sach-bao-mat">Bảo mật</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
