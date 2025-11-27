import { useState } from 'react';
import { Card, Form, Input, Button, message, Space, List, Typography, Modal } from 'antd';
import api from '../utils/api';
import CardSetBoard, { type CardSetHandle, type CardSetState } from '../components/CardSetBoard';
import useAuthStore from '../stores/auth';
import { useNavigate } from 'react-router-dom';

function ParsePage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cardSetState, setCardSetState] = useState<CardSetState | null>(null);
  const [boardRef] = useState<React.RefObject<CardSetHandle>>(() => ({ current: null } as React.RefObject<CardSetHandle>));
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const scoreLabel = (score: number) => {
    if (score > 17) return '超级';
    if (score > 10 && score < 17) return '明显';
    return '一般';
  };

  const buildScoreText = (scores: Record<string, number>) =>
    `红: ${scores.red ?? 0}（${scoreLabel(scores.red ?? 0)}） | 蓝: ${scores.blue ?? 0}（${scoreLabel(
      scores.blue ?? 0,
    )}） | 黄: ${scores.yellow ?? 0}（${scoreLabel(scores.yellow ?? 0)}） | 绿: ${scores.green ?? 0}（${scoreLabel(
      scores.green ?? 0,
    )}）`;

  const doSubmit = async (values: any, scoreText: string) => {
    const formData = new FormData();
    formData.append('card_type', values.card_type || '');
    formData.append('scene_desc', values.scene_desc || '');
    formData.append('cardset_layout', JSON.stringify(cardSetState?.layout || []));
    formData.append('cardset_scores', JSON.stringify(cardSetState?.scores || {}));
    formData.append('cardset_score_text', scoreText);
    formData.append('cardset_used_count', String(cardSetState?.usedCount || 0));
    formData.append('cardset_complete', String(cardSetState?.complete));

    // 打印提交调试信息（不包含敏感字段）
    // eslint-disable-next-line no-console
    console.log('[parse submit] payload', {
      card_type: values.card_type,
      scene_desc_len: (values.scene_desc || '').length,
      usedCount: cardSetState?.usedCount,
      complete: cardSetState?.complete,
      scoreText,
    });

    const msgKey = 'parse-submit';
    message.loading({ content: '步骤1/3：生成布局图片...', key: msgKey, duration: 0 });

    try {
      setLoading(true);
      // 生成布局图片并作为 image_files 传递
      if (boardRef.current?.captureImage) {
        const blob = await boardRef.current.captureImage();
        formData.append('image_files', blob, 'cardset.png');
      }

      message.loading({ content: '步骤2/3：调用大模型...', key: msgKey, duration: 0 });
      const { data } = await api.post('/ai/card/interpret-with-image', formData);
      message.loading({ content: '步骤3/3：等待返回结果...', key: msgKey, duration: 0 });

      setResult(data);
      message.success({ content: '解析完成', key: msgKey, duration: 2 });
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || '解析失败';
      if (err.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        logout();
        navigate('/login');
      } else {
        message.error(`解析失败：${detail}`);
      }
      message.destroy(msgKey);
      // eslint-disable-next-line no-console
      console.error('解析失败调试信息', {
        detail,
        status: err.response?.status,
        responseHeaders: err.response?.headers,
      });
    } finally {
      setLoading(false);
    }
  };

  const onFinish = (values: any) => {
    if (!cardSetState?.complete) {
      message.warning('请先完成卡牌摆放再提交解析');
      return;
    }

    const scoreText =
      cardSetState.scoreText && !cardSetState.scoreText.includes('未计分')
        ? cardSetState.scoreText
        : buildScoreText(cardSetState.scores || {});

    const layoutList =
      cardSetState.layout?.map((slot, idx) => {
        if (!slot) return `槽位 ${idx + 1}: 空`;
        return `槽位 ${idx + 1}: ${slot.title}（${slot.side === 'front' ? '正面' : '反面'}，${slot.color}，值 ${
          slot.value
        }）`;
      }) || [];

    Modal.confirm({
      title: '当前卡牌摆放明细与初步分析',
      width: 720,
      okText: '确认提交',
      cancelText: '取消',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>算牌结果：{scoreText}</Typography.Text>
          <Typography.Text type="secondary">已上阵 {cardSetState.usedCount}/12</Typography.Text>
          <List
            size="small"
            bordered
            dataSource={layoutList}
            renderItem={(item) => <List.Item>{item}</List.Item>}
            style={{ maxHeight: 320, overflow: 'auto' }}
          />
        </Space>
      ),
      onOk: () => doSubmit(values, scoreText),
    });
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="卡组摆放（支持拖拽、切换正反面、计算得分）" bordered>
        <CardSetBoard ref={boardRef} parsedCards={result?.cards_json} onStateChange={setCardSetState} />
      </Card>

      <Card title="卡牌解析" bordered>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="卡组类型" name="card_type">
            <Input />
          </Form.Item>
          <Form.Item label="场景描述" name="scene_desc" rules={[{ required: true, message: '请输入场景描述' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            提交解析
          </Button>
        </Form>
      </Card>

      {result && (
        <Card title="解析结果">
          <Typography.Paragraph>{result.ai_response}</Typography.Paragraph>
          <List
            header="识别到的卡牌"
            dataSource={result.cards_json || []}
            renderItem={(c: any) => (
              <List.Item>
                <Space>
                  <span>{c.name}</span>
                  {c.code && <span>#{c.code}</span>}
                  {c.position && <span>位置: {c.position}</span>}
                  {c.confidence && <span>置信度: {c.confidence}</span>}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
}

export default ParsePage;
