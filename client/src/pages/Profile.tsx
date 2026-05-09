import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Building2, Bell, Lock, Save, Camera, AlertCircle, CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, loading, updateProfile, updateAvatar, updateNotifications } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [orgInviteCode, setOrgInviteCode] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'nutricionista' as string,
    school: '',
    bio: '',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
  });

  // Fetch org invite code
  useEffect(() => {
    if (!user?.organizationId) return;
    getDoc(doc(db, 'organizations', user.organizationId))
      .then((snap) => {
        if (snap.exists()) setOrgInviteCode(snap.data().inviteCode || null);
      })
      .catch(() => {/* silent */});
  }, [user?.organizationId]);

  // Sync form and notifications when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        role: profile.role || 'nutricionista',
        school: profile.school || '',
        bio: profile.bio || '',
      });
      if (profile.notifications) {
        setNotifications(profile.notifications);
      }
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(122,41%,49%)] mx-auto" />
          <p className="text-muted-foreground">Carregando perfil…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar o perfil. Recarregue a página (F5).
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'U';
    return name
      .split(' ')
      .filter((n) => n.length > 0)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    fiscal: 'Fiscal PNAE',
    nutricionista: 'Nutricionista RT',
    diretor: 'Diretor(a)',
  };
  const getRoleLabel = (role: string) => roleLabels[role] || role;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (!user?.uid) {
      toast.error('Sessão expirada. Recarregue a página.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({
        id: user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role as any,
        school: formData.school,
        bio: formData.bio,
      });
      setIsEditing(false);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      role: profile.role || 'nutricionista',
      school: profile.school || '',
      bio: profile.bio || '',
    });
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await updateNotifications(notifications);
      toast.success('Preferências de notificação salvas!');
    } catch {
      toast.error('Erro ao salvar preferências.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      updateAvatar(base64);
      toast.success('Foto de perfil atualizada!');
    };
    reader.onerror = () => toast.error('Erro ao carregar a imagem');
    reader.readAsDataURL(file);
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais e preferências</p>
        </div>

        {/* Avatar + basic info card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                <Avatar className="w-32 h-32 border-4 border-accent/20">
                  <AvatarImage src={profile.avatar} alt={profile.name} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-bold">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-accent hover:bg-accent/90 text-white p-2 rounded-full cursor-pointer transition shadow-lg"
                  title="Alterar foto"
                >
                  <Camera className="w-4 h-4" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-2xl font-bold text-foreground">{profile.name}</h2>
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  {getRoleLabel(profile.role)}
                </Badge>
                <div className="flex flex-col md:flex-row gap-3 mt-3 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {profile.email}
                  </span>
                  {profile.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> {profile.phone}
                    </span>
                  )}
                  {profile.school && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> {profile.school}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="informacoes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="informacoes" className="flex items-center gap-2">
              <User className="w-4 h-4" /> Informações
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notificações
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Segurança
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Informações ─────────────────────────────────────────── */}
          <TabsContent value="informacoes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>
                  {isEditing ? 'Edite suas informações abaixo' : 'Visualize suas informações pessoais'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Nome Completo *</label>
                        <Input name="name" value={formData.name} onChange={handleInputChange} placeholder="Seu nome completo" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Email *</label>
                        <Input name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="seu@email.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Telefone</label>
                        <Input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="(14) 98765-4321" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Cargo *</label>
                        <Select value={formData.role} onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="fiscal">Fiscal PNAE</SelectItem>
                            <SelectItem value="nutricionista">Nutricionista RT</SelectItem>
                            <SelectItem value="diretor">Diretor(a)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-sm font-medium">Escola / Setor</label>
                        <Input name="school" value={formData.school} onChange={handleInputChange} placeholder="Nome da escola ou setor" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Bio / Descrição</label>
                      <Textarea name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Conte um pouco sobre você" rows={3} />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Salvando…' : 'Salvar Alterações'}
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline">Cancelar</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: 'Nome Completo', value: profile.name },
                        { label: 'Email', value: profile.email },
                        { label: 'Telefone', value: profile.phone || 'Não informado' },
                        { label: 'Cargo', value: getRoleLabel(profile.role) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                          <p className="font-semibold mt-0.5">{value}</p>
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Escola / Setor</p>
                        <p className="font-semibold mt-0.5">{profile.school || 'Não informada'}</p>
                      </div>
                    </div>
                    {profile.bio && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Bio</p>
                        <p className="mt-0.5">{profile.bio}</p>
                      </div>
                    )}
                    <Button onClick={() => setIsEditing(true)} className="gap-2 mt-2">
                      Editar Informações
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Notificações ────────────────────────────────────────── */}
          <TabsContent value="notificacoes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Escolha como deseja receber alertas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-accent/20 bg-accent/5">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <AlertDescription className="text-sm">
                    As notificações <strong>dentro do sistema</strong> (sino no menu) já estão ativas e funcionando. As opções abaixo são preferências adicionais.
                  </AlertDescription>
                </Alert>

                {[
                  {
                    key: 'email' as const,
                    title: 'Notificações por E-mail',
                    desc: 'Alertas sobre visitas agendadas, cardápios em análise e manutenções urgentes',
                  },
                  {
                    key: 'sms' as const,
                    title: 'Notificações por SMS',
                    desc: 'Mensagem de texto em casos urgentes (requer cadastro de telefone)',
                  },
                  {
                    key: 'push' as const,
                    title: 'Notificações no Navegador',
                    desc: 'Alertas pop-up no browser quando o sistema estiver aberto',
                  },
                ].map(({ key, title, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 border rounded-xl hover:bg-accent/5 transition"
                  >
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={notifications[key]}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}

                <Button onClick={handleSaveNotifications} disabled={isSaving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando…' : 'Salvar Preferências'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Segurança ───────────────────────────────────────────── */}
          <TabsContent value="seguranca" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Segurança da Conta</CardTitle>
                <CardDescription>Informações e configurações de acesso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Para alterar sua senha, entre em contato com o administrador do sistema ou use a opção de redefinição de senha no login.
                  </AlertDescription>
                </Alert>

                {/* Invite code card */}
                {orgInviteCode && (
                  <div className="p-4 border-2 border-green-200 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <KeyRound className="w-4 h-4 text-green-600" />
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        Código de Convite da Organização
                      </p>
                    </div>
                    <p className="text-xs text-green-600 mb-3">
                      Compartilhe este código com novos usuários para que entrem na sua organização.
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-mono font-bold tracking-widest text-green-800 bg-white px-4 py-2 rounded-lg border border-green-200">
                        {orgInviteCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(orgInviteCode).then(() => {
                            toast.success('Código copiado!');
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {[
                    { label: 'ID do Usuário', value: profile.id, mono: true },
                    {
                      label: 'Última Atualização',
                      value: new Date(profile.updatedAt).toLocaleDateString('pt-BR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }),
                    },
                    {
                      label: 'Conta criada em',
                      value: new Date(profile.createdAt).toLocaleDateString('pt-BR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      }),
                    },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="p-4 border rounded-xl">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className={`mt-1 text-sm ${mono ? 'font-mono break-all text-muted-foreground' : 'font-semibold'}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
