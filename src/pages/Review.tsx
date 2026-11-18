import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  learnApi,
  wordApi,
  personalizedApi,
  aiApi,
  errMsg,
  daysOverdue,
  isMeaningfulVietnamese,
  cleanDefinitionText,
  analyzeWordRelations,
  generateFallbackExplanation,
  isWordFavorited,
  myWordsApi,
} from '../api';
import type { Word, ProgressItem } from '../api';
import { TOPICS, TOPIC_LABELS } from '../constants/topics';
import { useUsage } from '../context/UsageContext';
import { Mascot, Icon } from '../components/icons';
import { AiExplanationBox } from '../components/AiExplanationBox';
import { useAuth } from '../auth/AuthContext';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  AnimatedCounter,
  AnimatedProgressBar,
  MotionCard,
  PageTransition,
  staggerContainer,
  staggerItem,
  motionTokens,
  mascotFloatVariant,
} from '../motion';
import viAvatar from '../assets/vi-3d.webp';

interface FlashcardWord {
  id: string | number;
  word: string;
  pronunciation?: string;
  meaning: string;
  vietnameseMeaning?: string;
  definition?: string;
  example?: string;
  level: string;
  partOfSpeech?: string;
  audioUrl?: string;
  progressId?: number;
  reviewCount?: number;
  isSrs?: boolean;
  overdue?: number;
}

const STUDY_MODES = [
  { id: 'RECOMMENDED', label: '✨ AI gợi ý' },
  { id: 'SRS', label: '⏰ Cần ôn (SRS)' },
  { id: 'TOPIC', label: '🗂️ Theo chủ đề' },
  { id: 'FAVORITES', label: '❤️ Yêu thích' },
  { id: 'MY_WORDS', label: '📝 Từ của tôi' },
] as const;

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'ALL'] as const;

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Review() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') || 'RECOMMENDED';
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m && m !== selectedMode) {
      setSelectedMode(m);
    }
  }, [searchParams]);

  // Storage key for roadmap data
  const storageKey = `vocab_ai_roadmap_${user?.id || user?.username || 'default'}`;
  const getInitialLevel = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile?.currentLevel) return parsed.profile.currentLevel;
      }
    } catch { }
    return 'B1';
  };

  const [recommendedLevel, setRecommendedLevel] = useState<string>(getInitialLevel);
  const { isVip, openUpgradeModal } = useUsage();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(searchParams.get('topic') || null);
  const [topicLevel, setTopicLevel] = useState<string>(() => {
    const init = getInitialLevel();
    return init || 'A1';
  });
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [loadingTopicCounts, setLoadingTopicCounts] = useState<boolean>(false);
  const [topicUpgradeRequired, setTopicUpgradeRequired] = useState<boolean>(false);

  useEffect(() => {
    if (selectedMode !== 'TOPIC') return;

    const isLocked = !isVip && (topicLevel === 'B1' || topicLevel === 'B2' || topicLevel === 'C1');
    if (isLocked) {
      setTopicUpgradeRequired(true);
      setTopicCounts({});
      return;
    }

    setTopicUpgradeRequired(false);
    setLoadingTopicCounts(true);
    wordApi
      .topicCounts(topicLevel === 'Tất cả' ? undefined : topicLevel)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            const key = item.topic?.name || item.topic || item.code;
            if (key) counts[key] = item.count ?? 0;
          });
        }
        setTopicCounts(counts);
      })
      .catch((e: any) => {
        const errCode = e?.response?.data?.code || e?.code;
        if (errCode === 'CEFR_B1_C1' || e?.response?.status === 403) {
          setTopicUpgradeRequired(true);
        }
        setTopicCounts({});
      })
      .finally(() => {
        setLoadingTopicCounts(false);
      });
  }, [selectedMode, topicLevel, isVip]);

  const handleTopicLevelChange = (newLevel: string) => {
    setTopicLevel(newLevel);
    setSelectedTopic(null);
  };

  // Đồng bộ selectedTopic lên URL để nút Back trình duyệt quay về được danh sách
  // (Effect 1: state -> URL, chỉ chạy khi selectedTopic đổi; KHÔNG thêm searchParams
  // vào deps của effect này, nếu không nó sẽ đẩy topic trở lại URL khi anh bấm Back)
  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    if (selectedTopic && urlTopic !== selectedTopic) {
      const next = new URLSearchParams(searchParams);
      next.set('topic', selectedTopic);
      setSearchParams(next);
    } else if (!selectedTopic && urlTopic) {
      const next = new URLSearchParams(searchParams);
      next.delete('topic');
      setSearchParams(next, { replace: true });
    }
  }, [selectedTopic]);

  // Đồng bộ URL -> state khi anh bấm Back/Forward của trình duyệt
  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    if (urlTopic !== selectedTopic) {
      setSelectedTopic(urlTopic);
    }
  }, [searchParams]);

  const [cards, setCards] = useState<FlashcardWord[]>([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Translation & AI explanation state
  const [activeVi, setActiveVi] = useState<string>('');
  const [aiDetail, setAiDetail] = useState<string | null>(null);
  const [loadingAiDetail, setLoadingAiDetail] = useState<boolean>(false);

  // Counters
  const [remembered, setRemembered] = useState(0);
  const [forgotten, setForgotten] = useState(0);

  // Favorite tracking for flashcard heart button (tracks both IDs and word texts)
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());

  const isCurFavorited = (card?: FlashcardWord | null): boolean => {
    return isWordFavorited(card, favoriteKeys);
  };

  useEffect(() => {
    const fetchFavs = () => {
      wordApi.favorites(0, 500)
        .then(({ data }) => {
          const keys = new Set<string>();
          (data?.content || []).forEach((w: any) => {
            if (w.id != null) keys.add(String(w.id).toLowerCase().trim());
            if (w.word) keys.add(String(w.word).toLowerCase().trim());
            if (w.lemma) keys.add(String(w.lemma).toLowerCase().trim());
          });
          (data?.localIds || []).forEach((id: any) => {
            if (id != null) keys.add(String(id).toLowerCase().trim());
          });
          setFavoriteKeys(keys);
        })
        .catch(() => {});
    };
    fetchFavs();
    window.addEventListener('vocab_favorites_changed', fetchFavs);
    return () => window.removeEventListener('vocab_favorites_changed', fetchFavs);
  }, []);

  const nav = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const cardTransitionVariants = {
    enter: (dir: 'next' | 'prev') => ({
      x: shouldReduce ? 0 : dir === 'next' ? 36 : -36,
      opacity: 0,
      scale: shouldReduce ? 1 : 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduce ? 0.15 : motionTokens.duration.normal,
        ease: motionTokens.ease.gentleOut,
      },
    },
    exit: (dir: 'next' | 'prev') => ({
      x: shouldReduce ? 0 : dir === 'next' ? -36 : 36,
      opacity: 0,
      scale: shouldReduce ? 1 : 0.98,
      transition: {
        duration: shouldReduce ? 0.1 : motionTokens.duration.fast,
        ease: motionTokens.ease.standard,
      },
    }),
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = cards[i];
    if (!cur?.id && !cur?.word) return;
    const idKey = cur.id != null ? String(cur.id).toLowerCase().trim() : '';
    const wordKey = cur.word ? cur.word.toLowerCase().trim() : '';
    const isFav = isCurFavorited(cur);

    // Optimistic UI update: immediately toggle in set
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (isFav) {
        if (idKey) next.delete(idKey);
        if (wordKey) next.delete(wordKey);
      } else {
        if (idKey) next.add(idKey);
        if (wordKey) next.add(wordKey);
      }
      return next;
    });

    try {
      if (isFav) {
        await wordApi.unfavorite(cur.id, cur.word);
      } else {
        await wordApi.favorite(cur.id, {
          id: cur.id,
          word: cur.word,
          lemma: cur.word,
          meaning: cur.meaning || cur.vietnameseMeaning || '',
          vietnameseMeaning: cur.vietnameseMeaning || cur.meaning || '',
          level: cur.level,
          partOfSpeech: cur.partOfSpeech,
          pronunciation: cur.pronunciation,
          definition: cur.definition,
          example: cur.example,
          audioUrl: cur.audioUrl,
        });
      }
    } catch {
      // Revert if API fails
      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        if (isFav) {
          if (idKey) next.add(idKey);
          if (wordKey) next.add(wordKey);
        } else {
          if (idKey) next.delete(idKey);
          if (wordKey) next.delete(wordKey);
        }
        return next;
      });
    }
  };

  // 1. Fetch AI level recommendation on mount & listen to roadmap updates
  useEffect(() => {
    personalizedApi.level()
      .then(({ data }) => {
        if (data) {
          setRecommendedLevel(data);
        }
      })
      .catch(() => { });

    const onRoadmapAnalyzed = (e: any) => {
      const lvl = e?.detail?.currentLevel;
      if (lvl) setRecommendedLevel(lvl);
    };
    window.addEventListener('vocab_roadmap_analyzed', onRoadmapAnalyzed);
    return () => window.removeEventListener('vocab_roadmap_analyzed', onRoadmapAnalyzed);
  }, [storageKey]);

  // 2. Fetch words based on selectedMode (randomized across levels)
  const loadCards = async (mode: string, recLevel: string, topic?: string | null) => {
    setLoading(true);
    setErr('');
    setI(0);
    setFlip(false);
    setAiDetail(null);
    setRemembered(0);
    setForgotten(0);
    setDirection('next');

    try {
      if (mode === 'FAVORITES') {
        const { data } = await wordApi.favorites(0, 100);
        const favWords = data.content || [];
        const formatted: FlashcardWord[] = favWords.map((w) => {
          const wText = w.word || w.lemma || '';
          const rawVi = w.vietnameseMeaning || w.meaning;
          const vi = isMeaningfulVietnamese(rawVi) ? rawVi : (rawVi || '');
          return {
            id: w.id,
            word: wText,
            pronunciation: w.pronunciation,
            meaning: vi,
            vietnameseMeaning: vi,
            definition: cleanDefinitionText(w.definition),
            example: w.example,
            level: w.level || w.cefrLevel || 'A1',
            partOfSpeech: w.partOfSpeech,
            audioUrl: w.audioUrl,
            isSrs: false,
          };
        });
        setCards(shuffleArray(formatted));
      } else if (mode === 'MY_WORDS') {
        const { data } = await myWordsApi.list({ size: 100 });
        const list = data?.data?.content || data?.content || [];
        const formatted: FlashcardWord[] = list.map((w: any) => ({
          id: `custom_${w.id}`,
          word: w.lemma,
          pronunciation: w.partOfSpeech ? `(${w.partOfSpeech})` : '',
          meaning: w.vietnameseMeaning,
          vietnameseMeaning: w.vietnameseMeaning,
          definition: w.vietnameseMeaning,
          example: w.example,
          level: w.cefrLevel || 'B1',
          partOfSpeech: w.partOfSpeech,
          isSrs: false,
          overdue: 0,
        }));
        setCards(shuffleArray(formatted));
      } else if (mode === 'SRS') {
        const { data } = await learnApi.queue(30);
        const rawItems: ProgressItem[] = data.content || [];
        const formatted: FlashcardWord[] = rawItems.map((it) => {
          const wText = it.word.word || it.word.lemma || '';
          const rawVi = it.word.vietnameseMeaning || it.word.meaning;
          const vi = isMeaningfulVietnamese(rawVi) ? rawVi : '';
          return {
            id: it.word.id,
            word: wText,
            pronunciation: it.word.pronunciation,
            meaning: vi,
            vietnameseMeaning: vi,
            definition: cleanDefinitionText(it.word.definition),
            example: it.word.example,
            level: it.word.level || it.word.cefrLevel || 'A1',
            partOfSpeech: it.word.partOfSpeech,
            audioUrl: it.word.audioUrl,
            progressId: it.id,
            reviewCount: it.reviewCount,
            isSrs: true,
            overdue: daysOverdue(it),
          };
        });
        // Ưu tiên hiển thị đúng từ được chọn từ Dashboard (nếu có param wordId hoặc word)
        const targetWordId = searchParams.get('wordId');
        const targetWord = searchParams.get('word')?.toLowerCase();
        let targetIdx = -1;
        if (targetWordId) {
          targetIdx = formatted.findIndex(
            (c) => String(c.id) === String(targetWordId) || String(c.progressId) === String(targetWordId)
          );
        }
        if (targetIdx === -1 && targetWord) {
          targetIdx = formatted.findIndex((c) => c.word.toLowerCase() === targetWord);
        }

        if (targetIdx !== -1) {
          const targetCard = formatted[targetIdx];
          const remaining = formatted.filter((_, idx) => idx !== targetIdx);
          setCards([targetCard, ...shuffleArray(remaining)]);
        } else if (targetWordId) {
          try {
            const wRes = await wordApi.get(targetWordId);
            const w = wRes?.data;
            if (w) {
              const wText = w.word || w.lemma || '';
              const rawVi = w.vietnameseMeaning || w.meaning;
              const vi = isMeaningfulVietnamese(rawVi) ? rawVi : '';
              const targetCard: FlashcardWord = {
                id: w.id,
                word: wText,
                pronunciation: w.pronunciation,
                meaning: vi,
                vietnameseMeaning: vi,
                definition: cleanDefinitionText(w.definition),
                example: w.example,
                level: w.level || w.cefrLevel || 'A1',
                partOfSpeech: w.partOfSpeech,
                audioUrl: w.audioUrl,
                isSrs: true,
                overdue: 0,
              };
              setCards([targetCard, ...shuffleArray(formatted)]);
            } else {
              setCards(shuffleArray(formatted));
            }
          } catch {
            setCards(shuffleArray(formatted));
          }
        } else {
          setCards(shuffleArray(formatted));
        }
      } else if (mode === 'TOPIC') {
        const activeTopic = topic || selectedTopic;
        if (!activeTopic) {
          setCards([]);
          setLoading(false);
          return;
        }
        const targetLevel = topicLevel === 'Tất cả' ? undefined : topicLevel;
        let rawWords: Word[] = [];

        try {
          const res = await wordApi.randomBatch({
            level: targetLevel,
            topic: activeTopic,
            limit: 25,
          });
          if (Array.isArray(res.data) && res.data.length > 0) {
            rawWords = res.data;
          }
        } catch (e) {
          console.warn('randomBatch for topic failed, falling back to list:', e);
        }

        if (rawWords.length === 0) {
          try {
            const fallback = await wordApi.list({
              level: targetLevel,
              topic: activeTopic,
              page: 0,
              size: 25,
            });
            rawWords = fallback.data?.content || [];
          } catch (e) {
            console.warn('fallback list for topic failed:', e);
          }
        }

        const shuffled = shuffleArray(rawWords);
        const formatted: FlashcardWord[] = shuffled.map((w) => {
          const wText = w.word || w.lemma || '';
          const rawVi = w.vietnameseMeaning || w.meaning;
          const vi = isMeaningfulVietnamese(rawVi) ? rawVi : '';
          return {
            id: w.id,
            word: wText,
            pronunciation: w.pronunciation,
            meaning: vi,
            vietnameseMeaning: vi,
            definition: cleanDefinitionText(w.definition),
            example: w.example,
            level: w.level || w.cefrLevel || (targetLevel || 'A1'),
            partOfSpeech: w.partOfSpeech,
            audioUrl: w.audioUrl,
            isSrs: false,
            overdue: 0,
          };
        });
        setCards(formatted);
      } else {
        const targetLevel = mode === 'RECOMMENDED' ? recLevel : mode === 'ALL' ? undefined : mode;
        let rawWords: Word[] = [];

        // 1. Try backend random-batch endpoint for uniform randomness across all level words
        try {
          const res = await wordApi.randomBatch({
            level: targetLevel,
            limit: 25,
          });
          if (Array.isArray(res.data) && res.data.length > 0) {
            rawWords = res.data;
          }
        } catch {
          // Fallback to client-side multi-page sampling
        }

        // 2. Fallback: multi-page sampling across dictionary to avoid alphabetical clustering
        if (rawWords.length === 0) {
          const LEVEL_MAX_PAGES: Record<string, number> = {
            A1: 25,
            A2: 25,
            B1: 20,
            B2: 35,
            C1: 40,
            ALL: 120,
          };
          const maxP = LEVEL_MAX_PAGES[targetLevel || 'ALL'] || 20;
          const p1 = Math.floor(Math.random() * Math.max(1, Math.floor(maxP / 2)));
          const p2 = Math.floor(Math.max(1, Math.floor(maxP / 2)) + Math.random() * Math.max(1, Math.floor(maxP / 2)));

          try {
            const [res1, res2] = await Promise.all([
              wordApi.list({ level: targetLevel, page: p1, size: 15 }),
              wordApi.list({ level: targetLevel, page: p2, size: 15 }),
            ]);
            const words1 = res1.data?.content || [];
            const words2 = res2.data?.content || [];
            const combined = [...words1, ...words2];
            if (combined.length > 0) {
              const seen = new Set<string | number>();
              rawWords = combined.filter((w) => {
                const k = w.id || w.word || w.lemma;
                if (!k || seen.has(k)) return false;
                seen.add(k);
                return true;
              });
            }
          } catch {
            // ignore
          }

          if (rawWords.length === 0) {
            const fallback = await wordApi.list({
              level: targetLevel,
              page: 0,
              size: 25,
            });
            rawWords = fallback.data?.content || [];
          }
        }

        // 3. Shuffle array to ensure non-alphabetical appearance every single time
        const shuffled = shuffleArray(rawWords);
        const formatted: FlashcardWord[] = shuffled.map((w) => {
          const wText = w.word || w.lemma || '';
          const rawVi = w.vietnameseMeaning || w.meaning;
          const vi = isMeaningfulVietnamese(rawVi) ? rawVi : '';
          return {
            id: w.id,
            word: wText,
            pronunciation: w.pronunciation,
            meaning: vi,
            vietnameseMeaning: vi,
            definition: cleanDefinitionText(w.definition),
            example: w.example,
            level: w.level || w.cefrLevel || (targetLevel || 'A1'),
            partOfSpeech: w.partOfSpeech,
            audioUrl: w.audioUrl,
            isSrs: false,
            overdue: 0,
          };
        });
        setCards(formatted);
      }
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMode === 'TOPIC') {
      if (selectedTopic) {
        loadCards('TOPIC', recommendedLevel, selectedTopic);
      } else {
        setCards([]);
        setLoading(false);
      }
    } else {
      loadCards(selectedMode, recommendedLevel);
    }
  }, [selectedMode, recommendedLevel, selectedTopic, topicLevel]);

  const cur = cards[i];

  // Resolve and set Vietnamese meaning for current card directly
  useEffect(() => {
    if (!cur?.word) {
      setActiveVi('');
      return;
    }

    setAiDetail(null);
    const rawVi = cur.vietnameseMeaning || cur.meaning;
    const vi = isMeaningfulVietnamese(rawVi) ? rawVi.trim() : '';
    setActiveVi(vi);
  }, [cur?.word, cur?.vietnameseMeaning, cur?.meaning, i]);

  // Play pronunciation via Web Speech API or audioUrl
  const playAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!cur) return;
    if (cur.audioUrl) {
      new Audio(cur.audioUrl).play().catch(() => { });
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cur.word);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  };

  const answer = async (ok: boolean) => {
    if (!cur) return;

    if (selectedMode === 'MY_WORDS') {
      if (ok) {
        setDirection('next');
        setRemembered((r) => r + 1);
        setFlip(false);
        setAiDetail(null);
        if (i + 1 >= cards.length) {
          setI(-1);
        } else {
          setI(i + 1);
        }
      } else {
        setDirection('prev');
        setForgotten((f) => f + 1);
        setFlip(false);
        setAiDetail(null);
        if (i > 0) {
          setI(i - 1);
        } else {
          setFlip(false);
        }
      }
      return;
    }

    if (ok) {
      // 1. Người dùng nhớ từ này -> Chuyển sang từ tiếp theo
      setDirection('next');
      setRemembered((r) => r + 1);
      if (cur.isSrs) {
        try {
          const res = await learnApi.review(cur.id, true);
          const updatedCount = res?.data?.data?.reviewCount ?? res?.data?.reviewCount;
          if (updatedCount != null) {
            setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, reviewCount: updatedCount } : c)));
          }
          window.dispatchEvent(new CustomEvent('vocab_review_completed', { detail: { wordId: cur.id, correct: true } }));
        } catch { /* ignore */ }
      } else {
        // Tự động thêm vào danh sách học để đưa vào SRS
        try { await learnApi.start(cur.id); } catch { /* ignore */ }
      }

      setFlip(false);
      setAiDetail(null);

      if (i + 1 >= cards.length) {
        setI(-1); // Hoàn thành phiên ôn tập
      } else {
        setI(i + 1);
      }
    } else {
      // 2. Người dùng CHƯA NHỚ từ này:
      // Yêu cầu: "khi tôi bấm vào chữ chưa nhớ phải quay lại từ trước đó"
      setDirection('prev');
      setForgotten((f) => f + 1);
      if (cur.isSrs) {
        try {
          const res = await learnApi.review(cur.id, false);
          const updatedCount = res?.data?.data?.reviewCount ?? res?.data?.reviewCount;
          if (updatedCount != null) {
            setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, reviewCount: updatedCount } : c)));
          }
          window.dispatchEvent(new CustomEvent('vocab_review_completed', { detail: { wordId: cur.id, correct: false } }));
        } catch { /* ignore */ }
      } else {
        try { await learnApi.start(cur.id); } catch { /* ignore */ }
      }

      setFlip(false);
      setAiDetail(null);

      if (i > 0) {
        setI(i - 1); // Quay lại từ trước đó
      } else {
        // Đang ở thẻ đầu tiên (i = 0), lật về mặt trước để người học xem lại từ đầu
        setFlip(false);
      }
    }
  };

  const explainWithAi = async () => {
    if (!cur) return;
    if (!flip) setFlip(true);
    if (aiDetail) {
      setAiDetail(null);
      return;
    }
    setLoadingAiDetail(true);
    try {
      const { data } = await aiApi.explain(cur.id, cur.word, {
        partOfSpeech: cur.partOfSpeech,
        level: cur.level,
        vietnameseMeaning: activeVi || cur.meaning,
      });
      setAiDetail(data.meaning);
    } catch {
      setAiDetail(
        generateFallbackExplanation(cur.word, cur.level, cur.partOfSpeech, activeVi || cur.meaning)
      );
    } finally {
      setLoadingAiDetail(false);
    }
  };

  // Keyboard shortcuts (Space = flip, ArrowLeft = Chưa nhớ, ArrowRight = Đã nhớ)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (i === -1 || cards.length === 0) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setFlip((f) => !f);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        answer(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        answer(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cur, i, cards.length]);

  // Completion Screen matching review-done.html
  if (i === -1) {
    const totalDone = remembered + forgotten;
    return (
      <motion.div
        className="content"
        style={{ maxWidth: 820 }}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <MotionCard style={{ textAlign: 'center', padding: '44px 34px', margin: '26px auto 0' }}>
          <img src={viAvatar} alt="Vi" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--sh)', margin: '0 auto' }} />
          <h1 style={{ fontSize: 31, fontWeight: 900, marginTop: 20 }}>Hoàn thành phiên ôn tập!</h1>
          <div className="sub mt8">
            {selectedMode === 'TOPIC' && selectedTopic ? (
              <>Bạn vừa ôn xong <b>{totalDone}</b> từ vựng chủ đề <b>{TOPIC_LABELS[selectedTopic] || selectedTopic}</b> ({topicLevel}).</>
            ) : (
              <>Bạn vừa ôn xong <b>{totalDone}</b> từ vựng — chuỗi streak được giữ vững.</>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
            <div className="kpi" style={{ minWidth: 150 }}><div className="lbl">Từ đã ôn</div><div className="num">{totalDone}</div></div>
            <div className="kpi" style={{ minWidth: 150 }}><div className="lbl">Đã nhớ</div><div className="num" style={{ color: 'var(--green-dark)' }}>{remembered}</div></div>
            <div className="kpi" style={{ minWidth: 150 }}><div className="lbl">Cần ôn lại sớm</div><div className="num" style={{ color: 'var(--red-dark)' }}>{forgotten}</div></div>
          </div>
          {forgotten > 0 && (
            <div className="sub mt16">{forgotten} từ chưa nhớ sẽ quay lại hàng đợi vào ngày mai theo lịch SRS.</div>
          )}
          <div className="btn-row mt16" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
            {forgotten > 0 && (
              <button className="btn ghost" style={{ minHeight: 52, padding: '0 24px' }} onClick={() => loadCards(selectedMode, recommendedLevel, selectedTopic)}>
                Ôn lại {forgotten} từ chưa nhớ
              </button>
            )}
            {selectedMode === 'TOPIC' && selectedTopic && (
              <>
                <button
                  className="btn"
                  style={{ minHeight: 52, padding: '0 24px', background: '#1565C0', borderColor: '#1565C0' }}
                  onClick={() => loadCards('TOPIC', recommendedLevel, selectedTopic)}
                >
                  🎲 Ôn tiếp bộ thẻ này
                </button>
                <button
                  className="btn ghost"
                  style={{ minHeight: 52, padding: '0 24px', color: '#1565C0', borderColor: '#BBDEFB' }}
                  onClick={() => {
                    setSelectedTopic(null);
                    setI(0);
                  }}
                >
                  ← Chọn chủ đề khác
                </button>
              </>
            )}
            <button className="btn" style={{ minHeight: 52, padding: '0 24px' }} onClick={() => nav('/dashboard')}>
              Về Tổng quan
            </button>
          </div>
        </MotionCard>
      </motion.div>
    );
  }

  const activeLevelDisplay = selectedMode === 'RECOMMENDED'
    ? `✨ AI gợi ý (${recommendedLevel})`
    : selectedMode === 'SRS'
      ? '⏰ Từ cần ôn (SRS)'
      : selectedMode === 'TOPIC'
        ? selectedTopic
          ? `🗂️ ${TOPIC_LABELS[selectedTopic] || selectedTopic} (${topicLevel})`
          : `🗂️ Theo chủ đề (${topicLevel})`
        : selectedMode === 'ALL'
          ? 'Tất cả cấp độ'
          : `Cấp độ ${selectedMode}`;

  return (
    <PageTransition className="review-page-container">
      <motion.div
        className="review-layout"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* CỘT BÊN TRÁI: Tiêu đề, thông số phiên ôn & Gợi ý từ Vi AI */}
        <motion.div className="review-left-col" variants={staggerItem}>
          {/* Badge & Title */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(79, 70, 229, 0.08)', borderRadius: 99, color: 'var(--primary)', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              <Icon n="bulb" s={13} /> Flashcard SRS
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)', margin: 0, lineHeight: 1.25 }}>
              {selectedMode === 'TOPIC' && !selectedTopic
                ? 'Ôn theo chủ đề'
                : 'Ôn Flashcard'}
            </h1>
            <div className="sub mt4" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
              {selectedMode === 'TOPIC' && !selectedTopic ? (
                'Hành trình 12 chủ đề từ vựng thiết thực'
              ) : loading ? (
                'Đang chuẩn bị bộ thẻ...'
              ) : cards.length === 0 ? (
                `Chưa có từ (${activeLevelDisplay})`
              ) : (
                `Thẻ ${i + 1} / ${cards.length} · ${activeLevelDisplay}`
              )}
            </div>
          </div>

          {/* Session Controls: Đổi bộ ngẫu nhiên & Counter pills */}
          {!(selectedMode === 'TOPIC' && !selectedTopic) && (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                padding: '12px 14px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <motion.button
                className="btn sm ghost"
                whileHover={{ y: -1, background: '#F1F5F9' }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: motionTokens.duration.fast }}
                onClick={() => {
                  setDirection('next');
                  loadCards(selectedMode, recommendedLevel, selectedTopic);
                }}
                title="Tải một bộ thẻ từ vựng ngẫu nhiên mới"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  minHeight: 36,
                  width: '100%',
                }}
              >
                🎲 Đổi bộ ngẫu nhiên
              </motion.button>
              <div style={{ display: 'flex', gap: 8 }}>
                <span
                  className="pill green"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    background: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #BBF7D0',
                    padding: '6px 8px',
                    borderRadius: 8,
                  }}
                >
                  ✓ <AnimatedCounter value={remembered} /> nhớ
                </span>
                <span
                  className="pill warn"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    background: '#FEE2E2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    padding: '6px 8px',
                    borderRadius: 8,
                  }}
                >
                  ✗ <AnimatedCounter value={forgotten} /> chưa
                </span>
              </div>
            </div>
          )}

          {/* Gợi ý từ Vi AI Card */}
          {recommendedLevel && (
            <MotionCard
              style={{
                background: 'linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)',
                border: '1px solid #DDD6FE',
                padding: '14px 16px',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(109, 40, 217, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <motion.div
                  variants={mascotFloatVariant}
                  animate={shouldReduce ? undefined : 'animate'}
                  style={{ display: 'inline-flex' }}
                >
                  <Mascot s={32} />
                </motion.div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>
                  Gợi ý từ Vi AI
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: '#1E1B4B', lineHeight: 1.5 }}>
                Dựa trên phân tích gần đây, Vi khuyên bạn nên tập trung ôn Flashcard cấp độ <b style={{ color: 'var(--primary)' }}>{recommendedLevel}</b> để củng cố phản xạ tốt nhất.
              </div>
              {selectedMode !== 'RECOMMENDED' && (
                <motion.button
                  className="btn sm ghost"
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: motionTokens.duration.fast }}
                  onClick={() => {
                    setSelectedTopic(null);
                    setSelectedMode('RECOMMENDED');
                  }}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    borderColor: '#C7D2FE',
                    color: 'var(--primary)',
                    background: '#FFFFFF',
                    minHeight: 32,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Chọn theo gợi ý AI ({recommendedLevel})
                </motion.button>
              )}
            </MotionCard>
          )}
        </motion.div>

        {/* CỘT Ở GIỮA: Flashcard và Nội dung ôn tập */}
        <motion.div className="review-center-col" variants={staggerItem}>
          {/* Breadcrumb when reviewing a specific topic */}
          {selectedMode === 'TOPIC' && selectedTopic && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <button
                className="btn sm ghost"
                onClick={() => {
                  setSelectedTopic(null);
                  setCards([]);
                  setI(0);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1565C0',
                  borderColor: '#BBDEFB',
                  background: '#F0F7FF',
                  minHeight: 32,
                  padding: '0 12px',
                  borderRadius: 999,
                }}
              >
                ← Tất cả chủ đề
              </button>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Đang ôn: <b style={{ color: '#1565C0' }}>{TOPIC_LABELS[selectedTopic] || selectedTopic}</b> · Cấp độ {topicLevel}
              </div>
            </div>
          )}

      {/* 1. TOPIC MODE: JOURNEY LIST VIEW (when selectedTopic === null) */}
      {selectedMode === 'TOPIC' && selectedTopic === null ? (
        <div style={{ marginTop: 8 }}>
          {/* Level Filter Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
              padding: '14px 18px',
              background: '#F8FAFC',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0F172A' }}>
                Hành trình 12 chủ đề từ vựng
              </div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                25 từ ngẫu nhiên mỗi chủ đề · Tự động đồng bộ vào chu trình SRS
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginRight: 4 }}>Cấp độ:</span>
              {['Tất cả', 'A1', 'A2', 'B1', 'B2', 'C1'].map((lvl) => {
                const isSelected = topicLevel === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => handleTopicLevelChange(lvl)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontSize: 12.5,
                      fontWeight: isSelected ? 800 : 600,
                      background: isSelected ? '#1565C0' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      border: isSelected ? '1px solid #1565C0' : '1px solid #CBD5E1',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {topicUpgradeRequired ? (
            <MotionCard
              style={{
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '1px solid #FDE68A',
                padding: '28px 20px',
                borderRadius: 16,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>👑</div>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: '#92400E' }}>
                Từ vựng chủ đề cấp độ {topicLevel} dành riêng cho Premium
              </div>
              <div style={{ fontSize: 13.5, color: '#B45309', marginTop: 6, maxWidth: 500, margin: '6px auto 16px' }}>
                Nâng cấp tài khoản Premium để mở khóa toàn bộ kho từ vựng B1–C1 theo mọi chủ đề chuyên sâu.
              </div>
              <button
                className="btn"
                onClick={() => openUpgradeModal({ feature: 'CEFR_B1_C1' })}
                style={{ background: '#D97706', borderColor: '#D97706', color: '#FFF', fontWeight: 800 }}
              >
                Mở khóa Premium ngay
              </button>
            </MotionCard>
          ) : (
            /* Vertical Journey Timeline */
            <div style={{ position: 'relative', paddingLeft: 34, marginTop: 12 }}>
              {/* Timeline ray running vertically on the left */}
              <div
                style={{
                  position: 'absolute',
                  left: 11,
                  top: 24,
                  bottom: 24,
                  width: 2,
                  background: '#BBDEFB',
                  borderRadius: 1,
                }}
              />

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {TOPICS.map((topic) => {
                  const count = topicCounts[topic.code] ?? 0;
                  const isDisabled = count === 0 && !loadingTopicCounts;

                  return (
                    <motion.div
                      key={topic.code}
                      variants={staggerItem}
                      whileHover={isDisabled ? undefined : {
                        y: -3,
                        borderColor: '#90CAF9',
                        boxShadow: '0 4px 14px rgba(21, 101, 192, 0.1)',
                      }}
                      whileTap={isDisabled ? undefined : { scale: 0.99 }}
                      transition={{ duration: motionTokens.duration.fast, ease: motionTokens.ease.gentleOut }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        background: '#FFFFFF',
                        borderRadius: 16,
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        padding: '13px 18px',
                        opacity: isDisabled ? 0.55 : 1,
                        cursor: isDisabled ? 'default' : 'pointer',
                      }}
                      onClick={() => !isDisabled && setSelectedTopic(topic.code)}
                    >
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: 'absolute',
                          left: -28,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: isDisabled ? '#90CAF9' : '#1565C0',
                          border: '2px solid #FFFFFF',
                          boxShadow: '0 0 0 2px #BBDEFB',
                        }}
                      />

                      {/* Left: Icon box & Topic info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: '#E3F2FD',
                            color: '#1565C0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                            flexShrink: 0,
                          }}
                        >
                          {topic.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 15.5,
                              fontWeight: 800,
                              color: isDisabled ? '#64748B' : '#0F172A',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {topic.label}
                          </div>
                          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                            {loadingTopicCounts ? (
                              'Đang tải số lượng từ...'
                            ) : (
                              `${count} từ · Cấp độ ${topicLevel}`
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Action button */}
                      <motion.button
                        className="btn sm"
                        disabled={isDisabled || loadingTopicCounts}
                        whileHover={isDisabled ? undefined : { scale: 1.04 }}
                        whileTap={isDisabled ? undefined : { scale: 0.96 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTopic(topic.code);
                        }}
                        style={{
                          flexShrink: 0,
                          minHeight: 36,
                          padding: '0 18px',
                          borderRadius: 999,
                          fontSize: 13.5,
                          fontWeight: 700,
                          background: isDisabled ? '#F1F5F9' : '#1565C0',
                          color: isDisabled ? '#94A3B8' : '#FFFFFF',
                          border: 'none',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          boxShadow: isDisabled ? 'none' : '0 2px 6px rgba(21, 101, 192, 0.25)',
                        }}
                      >
                        {isDisabled ? 'Chưa có từ' : 'Ôn ngay'}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}
        </div>
      ) : (
        /* 2. FLASHCARD VIEW (for other modes, or TOPIC with selectedTopic) */
        <>

      {/* Progress Bar */}
      {cards.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <AnimatedProgressBar value={((i + 1) / cards.length) * 100} />
        </div>
      )}

      {err && <div className="error">{err}</div>}

      {/* Loading state */}
      {loading && (
        <div className="card center" style={{ padding: 60 }}>
          <div className="loading">Đang chuẩn bị bộ thẻ flashcard...</div>
        </div>
      )}

      {/* Flashcard Component */}
      {!loading && cur && (
        <>
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={`card-${cur.id}-${i}`}
              custom={direction}
              variants={cardTransitionVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ width: '100%' }}
            >
              <div
                ref={cardRef}
                className="card flash"
                onClick={() => setFlip(!flip)}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  minHeight: 400,
                  padding: '40px 28px',
                  border: '1.5px solid var(--line)',
                  borderRadius: 22,
                  background: flip
                    ? 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)'
                    : 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFC 100%)',
                  boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.08)',
                  transition: 'background 0.3s ease, border-color 0.2s ease',
                  perspective: 1200,
                }}
              >
              {/* Top Bar on Flashcard */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'absolute',
                  top: 16,
                  left: 0,
                  padding: '0 22px',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="pill level" style={{ fontSize: 11.5, padding: '3px 10px', fontWeight: 800 }}>
                    {cur.level}
                  </span>
                  {(() => {
                    const r = analyzeWordRelations(cur.word, cur.partOfSpeech);
                    return cur.partOfSpeech ? (
                      <span
                        className="pill"
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          padding: '3px 10px',
                          background: r.posBadge.bg,
                          color: r.posBadge.color,
                          border: `1px solid ${r.posBadge.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{r.posBadge.icon}</span>
                        <span>{r.posBadge.label}</span>
                      </span>
                    ) : null;
                  })()}
                  {cur.isSrs && (
                    <span className="pill warn" style={{ fontSize: 11.5, padding: '3px 10px', fontWeight: 800 }}>
                      SRS
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {(() => {
                    const curIsFav = isCurFavorited(cur);
                    return (
                      <motion.button
                        type="button"
                        className="btn ghost sm"
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: motionTokens.duration.fast }}
                        onClick={toggleFavorite}
                        title={curIsFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                        style={{
                          borderRadius: '50%',
                          width: 38,
                          height: 38,
                          padding: 0,
                          background: curIsFav ? '#FEE2E2' : 'rgba(100, 116, 139, 0.08)',
                          color: curIsFav ? '#EF4444' : '#94A3B8',
                          border: `1.5px solid ${curIsFav ? '#FCA5A5' : 'var(--line)'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        aria-label="yêu thích"
                      >
                        <svg
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill={curIsFav ? '#EF4444' : 'none'}
                          stroke={curIsFav ? '#EF4444' : 'currentColor'}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: 'block', transition: 'fill 0.15s ease, stroke 0.15s ease' }}
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      </motion.button>
                    );
                  })()}

                  <motion.button
                    type="button"
                    className="btn ghost sm"
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: motionTokens.duration.fast }}
                    onClick={playAudio}
                    title="Nghe phát âm (Phím P)"
                    style={{ borderRadius: '50%', width: 38, height: 38, padding: 0, background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)', border: '1px solid #C7D2FE' }}
                    aria-label="phát âm"
                  >
                    <Icon n="vol" s={18} />
                  </motion.button>
                </div>
              </div>

              {/* Front & Back 3D Animated Flip */}
              <AnimatePresence mode="wait" initial={false}>
                {!flip ? (
                  <motion.div
                    key="front"
                    initial={shouldReduce ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
                    animate={shouldReduce ? { opacity: 1 } : { opacity: 1, rotateY: 0 }}
                    exit={shouldReduce ? { opacity: 0 } : { opacity: 0, rotateY: -90 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32, transformStyle: 'preserve-3d' }}
                  >
                    <div className="big" style={{ fontSize: 50, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
                      {cur.word}
                    </div>
                    {cur.pronunciation && (
                      <div className="sub mt8" style={{ fontSize: 20, color: 'var(--muted)', fontWeight: 600 }}>
                        {cur.pronunciation}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 40,
                        fontSize: 13.5,
                        color: 'var(--primary)',
                        fontWeight: 800,
                        background: '#EEF2FF',
                        border: '1px solid #C7D2FE',
                        padding: '9px 20px',
                        borderRadius: 99,
                        boxShadow: '0 2px 8px rgba(79, 70, 229, 0.08)',
                      }}
                    >
                      👆 Bấm vào thẻ để lật xem nghĩa tiếng Việt
                    </div>
                    <div className="sub mt8" style={{ fontSize: 12.5 }}>
                      Phím tắt: [Space] Lật thẻ · [←] Chưa nhớ · [→] Đã nhớ
                    </div>
                  </motion.div>
                ) : (
                  /* Back of Card */
                  <motion.div
                    key="back"
                    initial={shouldReduce ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
                    animate={shouldReduce ? { opacity: 1 } : { opacity: 1, rotateY: 0 }}
                    exit={shouldReduce ? { opacity: 0 } : { opacity: 0, rotateY: -90 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: 8, transformStyle: 'preserve-3d' }}
                  >
                    {(() => {
                      const rel = analyzeWordRelations(cur.word, cur.partOfSpeech);
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)' }}>
                              {cur.word}
                            </div>
                            {cur.partOfSpeech && (
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '3px 10px',
                                  borderRadius: 99,
                                  background: rel.posBadge.bg,
                                  color: rel.posBadge.color,
                                  border: `1px solid ${rel.posBadge.border}`,
                                }}
                              >
                                {rel.posBadge.icon} {rel.posBadge.shortLabel}
                              </span>
                            )}
                          </div>
                          {cur.pronunciation && (
                            <div className="sub mt4" style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}>
                              {cur.pronunciation}
                            </div>
                          )}

                          {/* VIETNAMESE MEANING HIGHLIGHT */}
                          <div
                            style={{
                              marginTop: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              width: '100%',
                              maxWidth: 540,
                              background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
                              padding: '18px 24px',
                              borderRadius: 16,
                              border: '1.5px solid #A7F3D0',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
                            }}
                          >
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11.5,
                                fontWeight: 800,
                                color: '#047857',
                                background: '#D1FAE5',
                                padding: '3px 10px',
                                borderRadius: 99,
                                border: '1px solid #A7F3D0',
                                letterSpacing: 0.5,
                              }}
                            >
                              🇻🇳 NGHĨA TIẾNG VIỆT
                            </div>

                            <div
                              className="mean"
                              style={{
                                fontSize: 26,
                                fontWeight: 900,
                                color: '#065F46',
                                textAlign: 'center',
                                marginTop: 8,
                                lineHeight: 1.35,
                              }}
                            >
                              {activeVi || (
                                <span style={{ fontSize: 16, color: 'var(--muted)', fontStyle: 'italic' }}>
                                  Đang cập nhật nghĩa tiếng Việt...
                                </span>
                              )}
                            </div>
                          </div>

                          {/* WORD & ADVERB DISAMBIGUATION / RELATIONSHIP BOX */}
                          {rel.warningNote && (
                            <div
                              style={{
                                marginTop: 14,
                                width: '100%',
                                maxWidth: 540,
                                background: '#FFFBEB',
                                border: '1.5px solid #FCD34D',
                                borderRadius: 14,
                                padding: '14px 18px',
                                textAlign: 'left',
                                fontSize: 13,
                                color: '#92400E',
                                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
                              }}
                            >
                              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span>🔍</span>
                                <span>Phân biệt Trạng từ & Từ gốc (Tránh nhầm lẫn):</span>
                              </div>
                              <div style={{ lineHeight: 1.5 }}>{rel.warningNote}</div>
                              {rel.exampleNote && (
                                <div style={{ marginTop: 6, fontStyle: 'italic', color: '#B45309', fontSize: 12.5 }}>
                                  👉 {rel.exampleNote}
                                </div>
                              )}
                            </div>
                          )}

                          {!rel.warningNote && rel.isAdverb && rel.rootWord && (
                            <div
                              style={{
                                marginTop: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 12.5,
                                background: '#F5F3FF',
                                border: '1px solid #DDD6FE',
                                color: '#6D28D9',
                                padding: '6px 14px',
                                borderRadius: 99,
                                maxWidth: 540,
                              }}
                            >
                              <span>💡 Tính từ gốc tương ứng:</span>
                              <b style={{ textDecoration: 'underline' }}>{rel.rootWord}</b>
                            </div>
                          )}

                          {!rel.warningNote && rel.isAdjective && rel.correspondingAdverb && (
                            <div
                              style={{
                                marginTop: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 12.5,
                                background: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                color: '#1D4ED8',
                                padding: '6px 14px',
                                borderRadius: 99,
                                maxWidth: 540,
                              }}
                            >
                              <span>⚡ Trạng từ tương ứng:</span>
                              <b style={{ textDecoration: 'underline' }}>{rel.correspondingAdverb}</b>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Oxford English Definition */}
                    {cur.definition && (
                      <div
                        style={{
                          marginTop: 14,
                          fontSize: 13.5,
                          maxWidth: 540,
                          textAlign: 'left',
                          lineHeight: 1.55,
                          color: 'var(--muted)',
                          background: '#F8FAFC',
                          padding: '10px 16px',
                          borderRadius: 10,
                          border: '1px solid var(--line)',
                        }}
                      >
                        <b style={{ color: 'var(--ink)' }}>English: </b>
                        {cleanDefinitionText(cur.definition)}
                      </div>
                    )}

                    {/* Example sentence */}
                    {cur.example && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 13.5,
                          fontStyle: 'italic',
                          color: 'var(--ink)',
                          background: 'rgba(79, 70, 229, 0.04)',
                          padding: '10px 16px',
                          borderRadius: 10,
                          maxWidth: 540,
                          textAlign: 'left',
                          lineHeight: 1.5,
                          borderLeft: '3px solid var(--primary)',
                        }}
                      >
                        💬 "{cur.example}"
                      </div>
                    )}

                    {cur.overdue !== undefined && cur.overdue > 0 && (
                      <div className="sub mt8" style={{ fontSize: 12, color: 'var(--red-dark)' }}>
                        Trễ lịch ôn tập {cur.overdue} ngày
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          </AnimatePresence>

          {/* Action Button Row */}
          <div className="btn-row mt16">
            <motion.button
              type="button"
              className="btn softred"
              whileHover={{ y: -2, boxShadow: '0 6px 16px rgba(220, 38, 38, 0.2)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: motionTokens.duration.fast }}
              style={{ flex: 1, minHeight: 52 }}
              onClick={() => answer(false)}
            >
              Chưa nhớ
            </motion.button>
            <motion.button
              type="button"
              className="btn ghost"
              whileHover={{ y: -2, boxShadow: '0 6px 16px rgba(21, 101, 192, 0.15)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: motionTokens.duration.fast }}
              style={{
                minHeight: 52,
                padding: '0 22px',
                color: 'var(--primary, #1565C0)',
                borderColor: '#C7D2FE',
                background: aiDetail ? '#EEF2FF' : '#FFFFFF',
                fontWeight: 800,
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={explainWithAi}
              disabled={loadingAiDetail}
            >
              <Icon n="spark" s={18} />
              {loadingAiDetail ? 'Vi đang giải thích...' : aiDetail ? 'Thu gọn giải thích' : 'Vi giải thích chuyên sâu'}
            </motion.button>
            <motion.button
              type="button"
              className="btn green"
              whileHover={{ y: -2, boxShadow: '0 6px 16px rgba(22, 163, 74, 0.25)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: motionTokens.duration.fast }}
              style={{ flex: 1, minHeight: 52 }}
              onClick={() => answer(true)}
            >
              Đã nhớ
            </motion.button>
          </div>

          {/* AI Explanation Area / Vi Coach Box */}
          {loadingAiDetail && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card mt16"
              style={{
                padding: '18px 24px',
                background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                border: '1.5px solid #C4B5FD',
                borderRadius: 16,
              }}
            >
              <div className="coach" style={{ alignItems: 'center' }}>
                <img src={viAvatar} alt="Vi" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <Icon n="spark" s={16} /> Vi đang soạn lời giải thích chuyên sâu...
                  </div>
                  <div className="sub mt4" style={{ fontSize: 13, color: '#7C3AED' }}>
                    Đang tổng hợp ví dụ thực tế, từ đồng nghĩa/trái nghĩa, ngữ cảnh sử dụng và mẹo ghi nhớ cho từ “{cur.word}”.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {aiDetail && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt16"
              style={{ width: '100%' }}
            >
              <AiExplanationBox explanation={aiDetail} />
            </motion.div>
          )}

          {!aiDetail && !loadingAiDetail && (
            <div className="card mt16">
              <div className="coach">
                <img src={viAvatar} alt="Vi" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover' }} />
                <div className="bubble">
                  <b>Vi đồng hành:</b> “{cur.word}” là từ vựng quan trọng ở cấp độ {cur.level}. Bạn có thể bấm “Vi giải thích chuyên sâu” để xem ngữ cảnh, từ đồng nghĩa và mẹo ghi nhớ!
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Topic-specific Empty State */}
      {!loading && cards.length === 0 && !err && selectedMode === 'TOPIC' && selectedTopic && (
        <div className="empty" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <Mascot s={80} />
          <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>
            Chủ đề “{TOPIC_LABELS[selectedTopic]}” chưa có từ ở cấp độ {topicLevel}
          </div>
          <div className="sub mt8" style={{ maxWidth: 440, margin: '8px auto 0' }}>
            Hiện chưa tìm thấy từ vựng thuộc chủ đề này ở cấp {topicLevel}. Bạn có thể chuyển sang cấp độ khác hoặc chọn chủ đề khác trong danh sách hành trình.
          </div>
          <div className="btn-row mt16" style={{ justifyContent: 'center' }}>
            <button
              className="btn"
              style={{ background: '#1565C0', borderColor: '#1565C0' }}
              onClick={() => {
                setSelectedTopic(null);
                setI(0);
              }}
            >
              ← Quay về danh sách hành trình
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setTopicLevel('Tất cả');
                loadCards('TOPIC', recommendedLevel, selectedTopic);
              }}
            >
              Xem ở tất cả cấp độ
            </button>
          </div>
        </div>
      )}

      {/* General Empty State */}
      {!loading && cards.length === 0 && !err && selectedMode !== 'TOPIC' && (
        <div className="empty" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <Mascot s={80} />
          <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>
            {selectedMode === 'SRS'
              ? 'Hết từ cần ôn SRS — giỏi quá!'
              : `Chưa có từ vựng nào ở cấp độ "${activeLevelDisplay}"`}
          </div>
          <div className="sub mt8" style={{ maxWidth: 420, margin: '8px auto 0' }}>
            {selectedMode === 'SRS'
              ? 'Hôm nay bạn đã ôn sạch các từ đến hạn. Hãy chọn một cấp độ khác bên trên để tiếp tục luyện Flashcard nhé!'
              : 'Hãy thử chọn một cấp độ khác hoặc bấm vào "AI gợi ý" để ôn tập từ vựng thích hợp.'}
          </div>
          <div className="btn-row mt16" style={{ justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={() => setSelectedMode(recommendedLevel || 'A1')}
            >
              Ôn Flashcard cấp độ {recommendedLevel || 'A1'}
            </button>
            <button className="btn ghost" onClick={() => nav('/words')}>
              Khám phá kho từ vựng
            </button>
          </div>
        </div>
      )}
        </>
      )}
        </motion.div>

        {/* CỘT BÊN PHẢI: Các phần chọn chế độ và cấp độ thiết kế dọc */}
        <motion.div className="review-right-col" variants={staggerItem}>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              border: '1px solid #E2E8F0',
              padding: '16px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Nhóm 1: Chế độ ôn tập */}
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: 8, paddingLeft: 4 }}>
                Chế độ ôn tập
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STUDY_MODES.map((m) => {
                  const isSelected = selectedMode === m.id;
                  const label = m.id === 'RECOMMENDED' ? `✨ AI gợi ý (${recommendedLevel})` : m.label;
                  return (
                    <motion.button
                      key={m.id}
                      whileHover={{ x: 4, background: isSelected ? 'var(--tint-blue, #e0f2fe)' : '#F1F5F9' }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: motionTokens.duration.fast }}
                      onClick={() => {
                        if (selectedMode === m.id) {
                          if (m.id === 'TOPIC') setSelectedTopic(null);
                          else loadCards(m.id, recommendedLevel);
                        } else {
                          setSelectedTopic(null);
                          setSelectedMode(m.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: isSelected ? 800 : 600,
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid transparent',
                        background: isSelected ? 'var(--tint-blue, #e0f2fe)' : '#F8FAFC',
                        color: isSelected ? 'var(--primary-dark, #0369a1)' : '#334155',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>{label}</span>
                      {isSelected && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 900 }}>●</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Đường phân cách */}
            <div style={{ height: 1, background: '#F1F5F9' }} />

            {/* Nhóm 2: Cấp độ CEFR */}
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: 8, paddingLeft: 4 }}>
                Cấp độ CEFR
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {CEFR_LEVELS.map((lvl) => {
                  const isSelected = selectedMode === lvl;
                  const displayLabel = lvl === 'ALL' ? 'Tất cả' : lvl;
                  return (
                    <motion.button
                      key={lvl}
                      whileHover={{ y: -2, boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)' }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ duration: motionTokens.duration.fast }}
                      onClick={() => {
                        if (selectedMode === lvl) {
                          loadCards(lvl, recommendedLevel);
                        } else {
                          setSelectedTopic(null);
                          setSelectedMode(lvl);
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontSize: 12.5,
                        fontWeight: isSelected ? 800 : 600,
                        border: isSelected ? '1.5px solid var(--ink)' : '1px solid #E2E8F0',
                        background: isSelected ? 'var(--ink)' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {displayLabel}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
}
