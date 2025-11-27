import { useEffect, useState } from 'react';
import { Card, Table, Button, message, Form, Input } from 'antd';
import api from '../utils/api';
import useAuthStore from '../stores/auth';

function AdminPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [aiForm] = Form.useForm();
  const [aiStatus, setAiStatus] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/admin/users');
      setUsers(data);
      try {
        const cfg = await api.get('/admin/ai-config');
        aiForm.setFieldsValue({
          ...cfg.data,
          default_params: cfg.data.default_params ? JSON.stringify(cfg.data.default_params, null, 2) : '',
        });
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [aiForm]);

  const ban = async (id: number) => {
    await api.post(`/admin/users/${id}/ban`);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: false } : u)));
  };

  const saveAI = async () => {
    const values = aiForm.getFieldsValue();
    if (typeof values.default_params === 'string' && values.default_params.trim()) {
      try {
        values.default_params = JSON.parse(values.default_params);
      } catch (e) {
        message.error('default_params 需为合法 JSON');
        return;
      }
    }
    await api.patch('/admin/ai-config', values);
    message.success('已保存');
  };

  const testAI = async () => {
    const { data } = await api.get('/admin/ai/test');
    setAiStatus(data);
    message.success(`模型状态: ${data.status}`);
  };

  if (!user || user.role !== 'admin') return <Card>仅管理员可见</Card>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="用户管理">
        <Table
          dataSource={users}
          rowKey="id"
          columns={[
            { title: 'ID', dataIndex: 'id' },
            { title: 'Email', dataIndex: 'email' },
            { title: '角色', dataIndex: 'role' },
            { title: '可用', dataIndex: 'is_active', render: (v) => (v ? '是' : '否') },
            { title: '操作', render: (_, record) => <Button onClick={() => ban(record.id)}>封禁</Button> },
          ]}
        />
      </Card>

      <Card title="AI 配置">
        <Form form={aiForm} layout="vertical">
          <Form.Item label="Base URL" name="base_url"><Input /></Form.Item>
          <Form.Item label="模型名称" name="model"><Input /></Form.Item>
          <Form.Item label="Chat path" name="chat_completion_path"><Input /></Form.Item>
          <Form.Item label="默认参数 (JSON)" name="default_params"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" onClick={saveAI}>保存</Button>
          <Button style={{ marginLeft: 8 }} onClick={testAI}>测试</Button>
          {aiStatus && <div style={{ marginTop: 8 }}>状态: {aiStatus.status} {aiStatus.model && `模型: ${aiStatus.model}`}</div>}
        </Form>
      </Card>
    </div>
  );
}

export default AdminPage;
