import { useEffect, useRef, useState } from 'react';
import { Card, Form, Input, Button, Space, message, Switch } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import api from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

function ArticleEditorPage() {
  const [content, setContent] = useState<string>('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromReadingId = searchParams.get('from_reading_id');
  const editId = searchParams.get('edit_id');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (editId) {
        const { data } = await api.get(`/articles/${editId}`);
        form.setFieldsValue({
          title: data.title,
          tags: (data.tags || []).join(','),
          is_published: data.is_published,
        });
        setContent(data.content_markdown || '');
        const coverMatch = data.content_markdown?.match(/!\[[^\]]*]\(([^)]+)\)/);
        if (coverMatch) setCoverUrl(coverMatch[1]);
      }
    };
    load();
  }, [editId, form]);

  const handleUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post('/ai/upload', fd);
      setCoverUrl(data.url);
      message.success('封面上传成功');
    } catch (err: any) {
      message.error(err.response?.data?.detail || err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onFinish = async (values: any) => {
    if (!values.title) {
      message.warning('请输入标题');
      return;
    }
    if (!content.trim()) {
      message.warning('请输入正文');
      return;
    }
    const mdWithCover = coverUrl ? `![封面](${coverUrl})\n\n${content}` : content;
    try {
      const tagNames = [
        ...(values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
        '文章',
      ].filter((t) => t && !/^\d+$/.test(t));
      const uniqueTags = Array.from(new Set(tagNames));
      let data;
      if (editId) {
        const res = await api.patch(`/articles/${editId}`, {
          title: values.title,
          content_markdown: mdWithCover,
          is_published: values.is_published ?? false,
          tag_names: uniqueTags,
        });
        data = res.data;
      } else {
        const res = await api.post('/articles', {
          title: values.title,
          content_markdown: mdWithCover,
          is_published: values.is_published ?? false,
          tag_names: uniqueTags,
          from_reading_id: fromReadingId ? Number(fromReadingId) : null,
        });
        data = res.data;
      }
      message.success('发布成功');
      navigate(`/articles/${data.id}`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '发布失败');
    }
  };

  return (
    <Card title="发布文章">
      <Form layout="vertical" onFinish={onFinish} form={form} initialValues={{ is_published: false }}>
        <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入标题" />
        </Form.Item>
        <Form.Item label="标签" name="tags" extra="用逗号分隔">
          <Input placeholder="例如 tarot, ai" />
        </Form.Item>
        <Form.Item label="封面">
          <Space>
            <Button icon={<UploadOutlined />} loading={uploading} onClick={() => fileInputRef.current?.click()}>
              上传封面
            </Button>
            {coverUrl && <span style={{ color: '#16a34a' }}>已上传</span>}
          </Space>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </Form.Item>
        <Form.Item label="是否发布到社区" name="is_published" valuePropName="checked">
          <Switch />
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
