import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { DragEvent, ForwardedRef, TouchEvent } from 'react';
import { Button, Space, Tag, message, Spin } from 'antd';
import { ReloadOutlined, CalculatorOutlined, ExportOutlined, InboxOutlined, BugOutlined } from '@ant-design/icons';
import api from '../utils/api';
import './CardSetBoard.css';

type CardColor = 'red' | 'blue' | 'yellow' | 'green';
type CardSide = 'front' | 'back';

interface CardFace {
  title: string;
  english: string;
  value: number;
  color: CardColor;
  image?: string | null;
}

interface CardDefinition {
  id: string;
  front: CardFace;
  back: CardFace;
}

export interface ParsedCardItem {
  name?: string;
  title?: string;
  code?: string;
  position?: number | string;
  side?: CardSide;
}

type SlotCard = CardFace & { cardId: string; side: CardSide; slotIndex: number };

export interface CardSetState {
  layout: Array<
    | {
        cardId: string;
        side: CardSide;
        title: string;
        english: string;
        value: number;
        color: CardColor;
        slotIndex: number;
        row?: number;
        col?: number;
        rowLabel?: string;
        positionLabel?: string;
      }
    | null
  >;
  scores: Record<CardColor, number>;
  scoreText: string;
  complete: boolean;
  usedCount: number;
}

interface CardSetBoardProps {
  parsedCards?: ParsedCardItem[];
  onStateChange?: (state: CardSetState) => void;
}

export interface CardSetHandle {
  captureImage: () => Promise<Blob>;
}

const emptySlots = () => Array<SlotCard | null>(12).fill(null);

const slotScoreLabel = (score: number) => {
  if (score > 17) return '高潜';
  if (score > 10 && score < 17) return '中潜';
  return '一般';
};

const scoreLine = (scores: Record<CardColor, number>) =>
  `红: ${scores.red}（${slotScoreLabel(scores.red)}） | 蓝: ${scores.blue}（${slotScoreLabel(scores.blue)}） | 黄: ${scores.yellow}（${slotScoreLabel(scores.yellow)}） | 绿: ${scores.green}（${slotScoreLabel(scores.green)}）`;

const colorTone: Record<CardColor, string> = {
  red: '#fecdd3',
  blue: '#bfdbfe',
  yellow: '#fef9c3',
  green: '#bbf7d0',
};

const parsePosition = (position: number | string | undefined): number | null => {
  if (position === undefined || position === null) return null;
  const parsed = typeof position === 'number' ? position : parseInt(position, 10);
  if (!Number.isFinite(parsed)) return null;
  const idx = parsed - 1;
  return idx >= 0 && idx < 12 ? idx : null;
};

function CardSetBoardBase({ parsedCards, onStateChange }: CardSetBoardProps, ref: ForwardedRef<CardSetHandle>) {
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [slots, setSlots] = useState<(SlotCard | null)[]>(() => emptySlots());
  const [used, setUsed] = useState<Set<string>>(() => new Set());
  const [deckFace, setDeckFace] = useState<Record<string, CardSide>>(() => ({}));
  const [scoreText, setScoreText] = useState('当前未计分，点击下方按钮查看加成分数。');
  const dragSource = useRef<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const touchSource = useRef<number | null>(null);

  const cardMap = useMemo(
    () =>
      cards.reduce<Record<string, CardDefinition>>((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {}),
    [cards],
  );

  const usedCount = useMemo(() => slots.filter(Boolean).length, [slots]);
  const unusedCards = useMemo(() => cards.filter((c) => !used.has(c.id)), [cards, used]);

  useEffect(() => {
    const fetchCards = async () => {
      setLoadingCards(true);
      try {
        const { data } = await api.get<CardDefinition[]>('/ai/cards');
        setCards(data || []);
      } catch (err: any) {
        message.error(err?.message || '卡牌列表加载失败');
        setCards([]);
      } finally {
        setLoadingCards(false);
      }
    };
    fetchCards();
  }, []);

  useEffect(() => {
    if (!cards.length) return;
    const nextDeck = cards.reduce<Record<string, CardSide>>((acc, card) => {
      acc[card.id] = 'front';
      return acc;
    }, {});
    setDeckFace(nextDeck);
    setSlots(emptySlots());
    setUsed(new Set());
    setScoreText('当前未计分，点击下方按钮查看加成分数。');
  }, [cards]);

  const calculateScores = (currentSlots: (SlotCard | null)[]) => {
    const scores: Record<CardColor, number> = { red: 0, blue: 0, yellow: 0, green: 0 };
    currentSlots.forEach((slot, idx) => {
      if (!slot) return;
      const row = Math.floor(idx / 4);
      const bonus = row === 0 ? 2 : row === 1 ? 1 : 0;
      scores[slot.color] += Number(slot.value || 0) + bonus;
    });
    return scores;
  };
  const currentScores = useMemo(() => calculateScores(slots), [slots]);

  const getFace = (card: CardDefinition, side: CardSide): CardFace => {
    const face = card[side];
    return {
      ...face,
      image: face.image || null,
    };
  };

  const matchCardByName = (name?: string) => {
    if (!name) return null;
    const target = name.trim();
    const matchFront = cards.find((c) => c.front.title === target || c.front.english === target || c.id === target);
    if (matchFront) return { card: matchFront, side: 'front' as CardSide };
    const matchBack = cards.find((c) => c.back.title === target || c.back.english === target);
    if (matchBack) return { card: matchBack, side: 'back' as CardSide };
    return null;
  };

  const slotToLayoutItem = (slot: SlotCard, idx: number) => {
    const slotIndex = slot.slotIndex ?? idx;
    const row = Math.floor(slotIndex / 4) + 1;
    const col = (slotIndex % 4) + 1;
    const rowLabel = row === 1 ? '第一排' : row === 2 ? '第二排' : '第三排';
    const positionLabel = `${rowLabel} 第${col}位`;
    return {
      cardId: slot.cardId,
      side: slot.side,
      title: slot.title,
      english: slot.english,
      value: slot.value,
      color: slot.color,
      slotIndex,
      row,
      col,
      rowLabel,
      positionLabel,
    };
  };

  useEffect(() => {
    if (!onStateChange) return;
    const layout = slots.map((slot, idx) => (slot ? slotToLayoutItem(slot, idx) : null));
    onStateChange({
      layout,
      scores: currentScores,
      scoreText,
      complete: layout.every(Boolean),
      usedCount,
    });
  }, [slots, currentScores, scoreText, onStateChange, usedCount]);

  const handleReset = () => {
    setSlots(emptySlots());
    setUsed(new Set());
    setDeckFace((prev) => {
      const next: Record<string, CardSide> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = 'front';
      });
      return next;
    });
    setScoreText('当前未计分，点击下方按钮查看加成分数。');
  };

  const debugFillRandom = () => {
    if (!cards.length) {
      message.info('没有可用卡牌');
      return;
    }
    const pool = [...cards].sort(() => Math.random() - 0.5).slice(0, 12);
    const nextSlots = emptySlots();
    const nextUsed = new Set<string>();
    const nextDeckFace: Record<string, CardSide> = { ...deckFace };

    pool.forEach((card, idx) => {
      const side: CardSide = Math.random() > 0.5 ? 'back' : 'front';
      const face = getFace(card, side);
      nextSlots[idx] = {
        ...face,
        cardId: card.id,
        side,
        slotIndex: idx,
      };
      nextUsed.add(card.id);
      nextDeckFace[card.id] = side;
    });

    setSlots(nextSlots);
    setUsed(nextUsed);
    setDeckFace(nextDeckFace);
    const scores = calculateScores(nextSlots);
    setScoreText(scoreLine(scores));
  };

  const handleCalc = () => {
    const scores = calculateScores(slots);
    setScoreText(scoreLine(scores));
  };

  const handleExport = () => {
    const layout = slots.map((slot, idx) => (slot ? slotToLayoutItem(slot, idx) : null));
    // eslint-disable-next-line no-console
    console.log('[cardset] 当前阵列', layout);
    message.success('已将当前阵列输出到控制台');
  };

  const captureImage = async () => {
    const cols = 4;
    const rows = 3;
    const slotW = 240;
    const slotH = 300;
    const padding = 20;
    const canvas = document.createElement('canvas');
    canvas.width = cols * slotW + padding * 2 + (cols - 1) * 14;
    canvas.height = rows * slotH + padding * 2 + (rows - 1) * 14 + 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      message.error('导出失败，无法创建画布');
      return Promise.reject(new Error('Canvas not available'));
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText('卡牌阵列', padding, padding + 12);

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    for (let i = 0; i < rows * cols; i += 1) {
      const slot = slots[i];
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = padding + col * (slotW + 14);
      const y = padding + 24 + row * (slotH + 14);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.setLineDash(slot ? [] : [8, 8]);
      ctx.strokeRect(x, y, slotW, slotH);
      ctx.setLineDash([]);

      if (slot) {
        if (slot.image) {
          try {
            const img = await loadImage(slot.image);
            const ratio = Math.min(slotW / img.width, slotH / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const dx = x + (slotW - w) / 2;
            const dy = y + (slotH - h) / 2;
            ctx.drawImage(img, dx, dy, w, h);
          } catch (err) {
            ctx.fillStyle = colorTone[slot.color] || '#fff';
            ctx.fillRect(x, y, slotW, slotH);
            ctx.fillStyle = '#111827';
            ctx.font = '16px Segoe UI';
            ctx.fillText(slot.title, x + 12, y + 28);
          }
        } else {
          ctx.fillStyle = colorTone[slot.color] || '#fff';
          ctx.fillRect(x, y, slotW, slotH);
          ctx.fillStyle = '#111827';
          ctx.font = '16px Segoe UI';
          ctx.fillText(slot.title, x + 12, y + 28);
        }
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Segoe UI';
        ctx.fillText('空位', x + slotW / 2 - 16, y + slotH / 2);
      }
    }

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('生成图片失败'));
      }, 'image/png');
    });
  };

  async function exportAsImage() {
    try {
      const blob = await captureImage();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'cardset.png';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      message.success('已导出当前阵列为图片');
    } catch (err: any) {
      message.error(err?.message || '导出失败');
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      captureImage,
    }),
    [slots],
  );

  const findFirstEmptySlot = () => slots.findIndex((slot) => slot === null);

  const handlePlaceCard = (cardId: string, side: CardSide) => {
    if (used.has(cardId)) return;
    const cardDef = cardMap[cardId];
    if (!cardDef) return;
    const targetIdx = findFirstEmptySlot();
    if (targetIdx === -1) {
      message.warning('空位已满，请先调整下方阵列');
      return;
    }
    const face = getFace(cardDef, side);
    setSlots((prev) => {
      const next = [...prev];
      next[targetIdx] = { ...face, cardId, side, slotIndex: targetIdx };
      return next;
    });
    setUsed((prev) => new Set([...prev, cardId]));
    setDeckFace((prev) => ({ ...prev, [cardId]: side }));
  };

  const handleSlotClick = (idx: number) => {
    const slot = slots[idx];
    if (!slot) return;
    const cardDef = cardMap[slot.cardId];
    if (!cardDef) return;
    const nextSide: CardSide = slot.side === 'front' ? 'back' : 'front';
    const face = getFace(cardDef, nextSide);
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = {
        ...slot,
        side: nextSide,
        title: face.title,
        english: face.english,
        value: face.value,
        color: face.color,
        image: face.image,
      };
      return next;
    });
  };

  const swapSlots = (sourceIdx: number, targetIdx: number) => {
    if (sourceIdx === targetIdx) return;
    setSlots((prev) => {
      const next = [...prev];
      const sourceCard = next[sourceIdx];
      const targetCard = next[targetIdx];
      next[targetIdx] = sourceCard ? { ...sourceCard, slotIndex: targetIdx } : null;
      next[sourceIdx] = targetCard ? { ...targetCard, slotIndex: sourceIdx } : null;
      return next;
    });
  };

  const handleSlotDragStart = (idx: number) => (event: DragEvent<HTMLDivElement>) => {
    if (!slots[idx]) return;
    dragSource.current = idx;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'slot');
  };

  const handleSlotDragOver = (idx: number) => (event: DragEvent<HTMLDivElement>) => {
    if (dragSource.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (hoverSlot !== idx) setHoverSlot(idx);
  };

  const handleSlotDragLeave = () => {
    setHoverSlot((prev) => (prev !== null ? null : prev));
  };

  const handleSlotDrop = (idx: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceIdx = dragSource.current;
    dragSource.current = null;
    setHoverSlot(null);
    if (sourceIdx === null || sourceIdx === idx) return;
    swapSlots(sourceIdx, idx);
  };

  const handleSlotDragEnd = () => {
    dragSource.current = null;
    setHoverSlot(null);
  };

  const handleSlotTouchStart = (idx: number) => (event: TouchEvent<HTMLDivElement>) => {
    if (!slots[idx]) return;
    touchSource.current = idx;
    setHoverSlot(idx);
    event.stopPropagation();
    event.preventDefault();
  };

  const findSlotIndexFromPoint = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y);
    const slotEl = target?.closest('.cardset-slot') as HTMLElement | null;
    const attr = slotEl?.dataset?.slotIndex;
    if (!attr) return null;
    const parsed = parseInt(attr, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSlotTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (touchSource.current === null) return;
    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;
    const idx = findSlotIndexFromPoint(touch.clientX, touch.clientY);
    if (idx !== null && hoverSlot !== idx) {
      setHoverSlot(idx);
    }
  };

  const handleSlotTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const sourceIdx = touchSource.current;
    touchSource.current = null;
    const touch = event.changedTouches[0];
    const targetIdx = touch ? findSlotIndexFromPoint(touch.clientX, touch.clientY) : null;
    setHoverSlot(null);
    if (sourceIdx === null || targetIdx === null || sourceIdx === targetIdx) return;
    swapSlots(sourceIdx, targetIdx);
  };

  const handleImportFromParsed = () => {
    if (!parsedCards || parsedCards.length === 0) {
      message.info('没有可导入的解析结果');
      return;
    }

    const nextSlots = emptySlots();
    const nextUsed = new Set<string>();
    const nextDeckFace: Record<string, CardSide> = { ...deckFace };

    parsedCards.forEach((item) => {
      const match = matchCardByName(item.title || item.name || item.code);
      if (!match) return;
      const slotIdx = parsePosition(item.position) ?? nextSlots.findIndex((slot) => slot === null);
      if (slotIdx === -1 || slotIdx === null) return;
      const chosenSide: CardSide = item.side === 'back' ? 'back' : match.side;
      const face = getFace(match.card, chosenSide);
      nextSlots[slotIdx] = {
        ...face,
        cardId: match.card.id,
        side: chosenSide,
        slotIndex: slotIdx,
      };
      nextUsed.add(match.card.id);
      nextDeckFace[match.card.id] = chosenSide;
    });

    setSlots(nextSlots);
    setUsed(nextUsed);
    setDeckFace(nextDeckFace);
    setScoreText('已根据解析结果导入卡牌，可继续调整。');
  };

  return (
    <div className="cardset-wrapper">
      <aside className="cardset-deck">
        <div className="cardset-deck-header">
          <div>
            <div className="cardset-title">卡组（正反面双列）</div>
            <div className="cardset-subtitle">点击需要的正面或反面，自动放入下方空位；已放置行会隐藏</div>
          </div>
          <Tag color="blue">{usedCount}/12 已放置</Tag>
        </div>
        {loadingCards ? (
          <div style={{ padding: 16 }}>
            <Spin /> 加载卡牌...
          </div>
        ) : (
          <div className="cardset-deck-list">
            {unusedCards.length === 0 ? (
              <div className="cardset-empty">所有可用卡牌都已放置</div>
            ) : (
              <div className="cardset-deck-grid">
                {unusedCards.map((card) => {
                  const frontFace = getFace(card, 'front');
                  const backFace = getFace(card, 'back');
                  return (
                    <div key={card.id} className="cardset-deck-row">
                      <div
                        className="cardset-deck-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handlePlaceCard(card.id, 'front')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePlaceCard(card.id, 'front');
                          }
                        }}
                      >
                        <span className="deck-side">正</span>
                        {frontFace.image ? (
                          <img className="deck-img" src={frontFace.image} alt={frontFace.title} />
                        ) : (
                          <div className="deck-img deck-placeholder">{frontFace.title}</div>
                        )}
                      </div>
                      <div
                        className="cardset-deck-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handlePlaceCard(card.id, 'back')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePlaceCard(card.id, 'back');
                          }
                        }}
                      >
                        <span className="deck-side">反</span>
                        {backFace.image ? (
                          <img className="deck-img" src={backFace.image} alt={backFace.title} />
                        ) : (
                          <div className="deck-img deck-placeholder">{backFace.title}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </aside>

      <section className="cardset-board">
        <div className="cardset-toolbar">
          <Space>
            <Button icon={<CalculatorOutlined />} onClick={handleCalc}>
              计算分数
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Button icon={<BugOutlined />} onClick={debugFillRandom}>
              随机填充
            </Button>
            <Button icon={<ExportOutlined />} onClick={exportAsImage}>
              导出阵列图片
            </Button>
          </Space>
          <Space>
            <Button icon={<InboxOutlined />} onClick={handleImportFromParsed} disabled={!parsedCards || parsedCards.length === 0}>
              导入识别结果
            </Button>
            <Button onClick={handleExport}>导出到控制台</Button>
          </Space>
        </div>

        <div className="cardset-slot-grid">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              data-slot-index={idx}
              className={`cardset-slot${slot ? ' filled' : ''}${hoverSlot === idx ? ' drag-over' : ''}`}
              onClick={() => handleSlotClick(idx)}
              onDragOver={handleSlotDragOver(idx)}
              onDragLeave={handleSlotDragLeave}
              onDrop={handleSlotDrop(idx)}
              onTouchStart={handleSlotTouchStart(idx)}
              onTouchMove={handleSlotTouchMove}
              onTouchEnd={handleSlotTouchEnd}
            >
              {slot ? (
                <div
                  className={`cardset-card${slot.image ? ' image-only' : ''}`}
                  draggable
                  onDragStart={handleSlotDragStart(idx)}
                  onDragEnd={handleSlotDragEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {slot.image ? <img className="slot-img" src={slot.image} alt={slot.title} /> : <span>{slot.title}</span>}
                </div>
              ) : (
                <span className="cardset-placeholder">空位</span>
              )}
            </div>
          ))}
        </div>

        <div className="cardset-instructions">
          <div>操作提示</div>
          <ol>
            <li>点击左侧正面或反面卡牌，将自动填充下方第一个空位，放置后该行会隐藏。</li>
            <li>点击已放置的卡牌可在正反面间切换；需要重算分数请点击“计算分数”。</li>
            <li>计分规则：三行加成为 +2 / +1 / +0，对应上到下三行。</li>
          </ol>
        </div>

        <div className="cardset-score">{scoreText}</div>
      </section>
    </div>
  );
}

const CardSetBoard = forwardRef<CardSetHandle, CardSetBoardProps>(CardSetBoardBase);

export default CardSetBoard;
