import { useState } from 'react';
import { Card, Form, Input, Button, Space, message } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import api from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

function ArticleEditorPage() {
  const [content, setContent] = useState<string>('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromReadingId = searchParams.get('from_reading_id');

  const onFinish = async (values: any) => {
    try {
      const { data } = await api.post('/articles', {
        title: values.title,
        content_markdown: content,
        tag_names: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : [],
        from_reading_id: fromReadingId ? Number(fromReadingId) : null,
      });
      message.success('发布成功');
      navigate(`/articles/${data.id}`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '发布失败');
    }
  };

  return (
    <Card title="发布文章">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="标题" name="title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="标签" name="tags" extra="用逗号分隔">
          <Input placeholder="例如 tarot, ai" />
        </Form.Item>
        <Form.Item label="正文">
          <div data-color-mode="light">
            <MDEditor value={content} onChange={(v) => setContent(v || '')} height={320} />
          </div>
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">发布</Button>
        </Space>
      </Form>
    </Card>
  );
}

export default ArticleEditorPage;
