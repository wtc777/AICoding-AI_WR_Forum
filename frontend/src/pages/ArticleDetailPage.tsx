import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Tag, Typography, List, Input, Button, message, Space } from 'antd';
import api from '../utils/api';
import useAuthStore from '../stores/auth';

function ArticleDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get(`/articles/${id}`);
      setArticle(data);
      const c = await api.get(`/articles/${id}/comments`);
      setComments(c.data);
    };
    load();
  }, [id]);

  const submitComment = async () => {
    if (!comment) return;
    try {
      const { data } = await api.post(`/articles/${id}/comments`, { content: comment });
      setComments((prev) => [...prev, data]);
      setComment('');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '评论失败');
    }
  };

  const like = async () => {
    try {
      await api.post(`/articles/${id}/like`);
      message.success('已点赞');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '点赞失败');
    }
  };

  if (!article) return null;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title={article.title} extra={<Button onClick={like}>?? 点赞</Button>}>
        <Space style={{ marginBottom: 12 }}>
          {article.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
          <Typography.Text type="secondary">{new Date(article.created_at).toLocaleString()}</Typography.Text>
        </Space>
        <div dangerouslySetInnerHTML={{ __html: article.content_html }} />
      </Card>

      <Card title="评论">
        <List
          dataSource={comments}
          renderItem={(c) => (
            <List.Item>
              <List.Item.Meta
                title={`用户 ${c.user_id}`}
                description={<Typography.Text>{c.content}</Typography.Text>}
              />
              <Typography.Text type="secondary">{new Date(c.created_at).toLocaleString()}</Typography.Text>
            </List.Item>
          )}
        />
        {user && (
          <Space style={{ marginTop: 12 }}>
            <Input.TextArea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写下你的想法" />
            <Button type="primary" onClick={submitComment}>发布评论</Button>
          </Space>
        )}
      </Card>
    </Space>
  );
}

export default ArticleDetailPage;
