import { Layout, Menu, Button } from 'antd';
import { Link, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ParsePage from './pages/ParsePage';
import ReadingsPage from './pages/ReadingsPage';
import ArticleEditorPage from './pages/ArticleEditorPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import AdminPage from './pages/AdminPage';
import useAuthStore from './stores/auth';

const { Header, Content, Footer } = Layout;

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuthStore();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const selected = useMemo(() => {
    if (location.pathname.startsWith('/parse')) return ['parse'];
    if (location.pathname.startsWith('/readings')) return ['readings'];
    if (location.pathname.startsWith('/articles/new')) return ['write'];
    return ['home'];
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontWeight: 700, marginRight: 24 }}>AI 卡牌大师</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={selected}
          items={[
            { key: 'home', label: <Link to="/">社区</Link> },
            { key: 'parse', label: <Link to="/parse">卡牌解析</Link> },
            { key: 'readings', label: <Link to="/readings">解析档案</Link> },
            { key: 'write', label: <Link to="/articles/new">发布文章</Link> },
          ]}
          style={{ flex: 1 }}
        />
        <div style={{ display: 'flex', gap: 12 }}>
          {user ? (
            <>
              <span style={{ color: '#fff' }}>{user.nickname}</span>
              <Button size="small" onClick={() => logout()}>退出</Button>
              {user.role === 'admin' && (
                <Button size="small" type="primary" onClick={() => navigate('/admin')}>后台</Button>
              )}
            </>
          ) : (
            <>
              <Button size="small" ghost onClick={() => navigate('/login')}>登录</Button>
              <Button size="small" type="primary" onClick={() => navigate('/register')}>注册</Button>
            </>
          )}
        </div>
      </Header>
      <Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/parse" element={<RequireAuth><ParsePage /></RequireAuth>} />
          <Route path="/readings" element={<RequireAuth><ReadingsPage /></RequireAuth>} />
          <Route path="/articles/new" element={<RequireAuth><ArticleEditorPage /></RequireAuth>} />
          <Route path="/articles/:id" element={<RequireAuth><ArticleDetailPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
      <Footer style={{ textAlign: 'center' }}>AI 卡牌大师 ©2025</Footer>
    </Layout>
  );
}

export default App;
