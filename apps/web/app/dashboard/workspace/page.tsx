"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, UserPlus, Plus, Shield, Check, Loader2, ArrowLeft, ArrowRight,
  UserX, Mail, MessageSquare, AlertCircle, Building2
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { useToast } from "../../../components/ui/Toast";

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

interface Member {
  id: string;
  userId: string;
  workspaceId: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  status: "ACCEPTED" | "PENDING";
  createdAt: string;
  user: {
    email: string;
  };
}

interface Invitation {
  id: string;
  workspaceId: string;
  role: string;
  status: string;
  workspace: {
    name: string;
    owner: {
      email: string;
    };
  };
}

export default function WorkspacePage() {
  const { token, user } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();
  const { success, error, info } = useToast();

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [isInviting, setIsInviting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    fetchInitialData();
  }, [token]);

  useEffect(() => {
    if (activeWorkspace && token) {
      fetchMembers(activeWorkspace.id);
    }
  }, [activeWorkspace]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [workspacesRes, invitesRes] = await Promise.all([
        fetch("http://localhost:4000/workspaces", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("http://localhost:4000/workspaces/invitations", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      let loadedWorkspaces: Workspace[] = [];
      if (workspacesRes.ok) {
        loadedWorkspaces = await workspacesRes.json();
        setWorkspaces(loadedWorkspaces);
        if (loadedWorkspaces.length > 0) {
          setActiveWorkspace(loadedWorkspaces[0]);
        }
      }
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setInvitations(invitesData);
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "فشل جلب مساحات العمل والدعوات" : "Failed to load workspaces list");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async (workspaceId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/workspaces/${workspaceId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsCreatingWorkspace(true);

    try {
      const res = await fetch("http://localhost:4000/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newWorkspaceName })
      });

      if (res.ok) {
        const workspaceData = await res.json();
        success(isRtl ? `تم إنشاء مساحة العمل "${newWorkspaceName}" بنجاح!` : `Workspace "${newWorkspaceName}" created!`);
        setNewWorkspaceName("");
        setWorkspaces([...workspaces, workspaceData]);
        setActiveWorkspace(workspaceData);
      } else {
        error(isRtl ? "فشل إنشاء مساحة عمل جديدة" : "Failed to create workspace");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setIsInviting(true);

    try {
      const res = await fetch(`http://localhost:4000/workspaces/${activeWorkspace.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      if (res.ok) {
        success(isRtl ? "تم إرسال دعوة الانضمام بنجاح!" : "Invitation sent successfully!");
        setInviteEmail("");
        fetchMembers(activeWorkspace.id);
      } else {
        const errData = await res.json();
        error(errData.message || (isRtl ? "فشل إرسال الدعوة" : "Failed to send invitation"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInviting(false);
    }
  };

  const handleAcceptInvite = async (invitationId: string) => {
    setIsActionLoading(invitationId);
    try {
      const res = await fetch(`http://localhost:4000/workspaces/invitations/${invitationId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        success(isRtl ? "تم قبول الدعوة بنجاح!" : "Invitation accepted successfully!");
        setInvitations(invitations.filter(i => i.id !== invitationId));
        fetchInitialData();
      } else {
        error(isRtl ? "فشل قبول الدعوة" : "Failed to accept invitation");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspace) return;
    if (!confirm(isRtl ? "هل أنت متأكد من رغبتك في حذف هذا العضو؟" : "Are you sure you want to remove this member?")) return;
    setIsActionLoading(memberId);

    try {
      const res = await fetch(`http://localhost:4000/workspaces/${activeWorkspace.id}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        success(isRtl ? "تم حذف العضو من مساحة العمل بنجاح." : "Member removed successfully.");
        setMembers(members.filter(m => m.id !== memberId));
      } else {
        error(isRtl ? "فشل حذف العضو من مساحة العمل" : "Failed to remove member");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(null);
    }
  };

  const translateRole = (role: string) => {
    const mapped: Record<string, string> = {
      OWNER: isRtl ? "المالك" : "Owner",
      ADMIN: isRtl ? "مدير" : "Admin",
      EDITOR: isRtl ? "محرر" : "Editor",
      VIEWER: isRtl ? "مشاهد" : "Viewer"
    };
    return mapped[role] || role;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070709] text-zinc-150 flex items-center justify-center">
        <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-900 px-6 py-4 rounded-3xl backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          <span className="text-xs font-bold font-mono tracking-wider">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  // Check user privileges in current workspace
  const userMemberInfo = members.find(m => m.userId === user?.id);
  const userRole = userMemberInfo?.role || (activeWorkspace?.ownerId === user?.id ? "OWNER" : "VIEWER");
  const isWorkspaceAdmin = userRole === "OWNER" || userRole === "ADMIN";

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-zinc-950/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span className="text-xs font-bold">{isRtl ? "الرئيسية" : "Dashboard"}</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-400" />
            <span className="font-extrabold text-sm text-white">{isRtl ? "مساحات العمل والفرق" : "Workspaces & Teams"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-10 flex-1 space-y-8 z-10 text-right rtl:text-right ltr:text-left">
        
        {/* Invitations Alert Banner if user has pending invitations */}
        {invitations.length > 0 && (
          <section className="bg-purple-950/15 border border-purple-500/20 p-5 rounded-3xl space-y-4">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-5 w-5 text-purple-400 animate-pulse" />
              <h3 className="text-sm font-extrabold text-purple-300">{isRtl ? "لديك دعوات انضمام معلقة لمساحات عمل مشتركة!" : "Pending workspace collaboration invitations!"}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {invitations.map((invite) => (
                <div key={invite.id} className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-2xl flex justify-between items-center text-xs">
                  <div className="space-y-1 pr-4 text-right">
                    <span className="font-extrabold text-white block">{invite.workspace.name}</span>
                    <span className="text-[10px] text-zinc-500 block">
                      {isRtl ? `بواسطة: ${invite.workspace.owner.email}` : `Invited by: ${invite.workspace.owner.email}`}
                    </span>
                    <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded block w-fit font-bold">
                      {isRtl ? `صلاحية: ${translateRole(invite.role)}` : `Role: ${invite.role}`}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isActionLoading === invite.id}
                    onClick={() => handleAcceptInvite(invite.id)}
                    className="py-1 px-3.5 text-[10px] font-bold"
                  >
                    {isActionLoading === invite.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    <span>{isRtl ? "موافقة وقبول" : "Accept Invitation"}</span>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Workspaces list selector & Create panel */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Create workspace form */}
            <div className="glass-panel p-5 rounded-3xl border border-white/5 space-y-4 shadow-lg">
              <div className="flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-purple-400" />
                <h4 className="text-xs font-black text-white">{isRtl ? "إنشاء مساحة عمل جديدة" : "Create New Workspace"}</h4>
              </div>
              
              <form onSubmit={handleCreateWorkspace} className="space-y-3">
                <Input
                  placeholder={isRtl ? "مثال: فريق التسويق" : "e.g. Video Editors Team"}
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="py-2.5 text-xs text-right"
                />
                <Button
                  type="submit"
                  variant="brand"
                  size="sm"
                  isLoading={isCreatingWorkspace}
                  className="w-full text-xs font-bold py-2"
                >
                  {isRtl ? "تأكيد الإنشاء" : "Create Workspace"}
                </Button>
              </form>
            </div>

            {/* List selectors */}
            <div className="glass-panel p-5 rounded-3xl border border-white/5 space-y-3 shadow-lg">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block border-b border-zinc-900 pb-2">
                {isRtl ? "مساحات العمل الخاصة بك" : "Your Collaboration Hubs"}
              </span>

              {workspaces.length === 0 ? (
                <div className="text-center py-6 text-[10px] text-zinc-500 font-mono">
                  {isRtl ? "لا توجد مساحات عمل نشطة" : "No workspaces active"}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {workspaces.map((ws) => {
                    const isActive = activeWorkspace?.id === ws.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => setActiveWorkspace(ws)}
                        className={`w-full text-right p-3 rounded-2xl border transition-all text-xs font-bold flex items-center justify-between cursor-pointer ${
                          isActive
                            ? "border-purple-500 bg-purple-500/5 text-white"
                            : "border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <Building2 className={`h-4 w-4 ${isActive ? "text-purple-400" : "text-zinc-650"}`} />
                        <span>{ws.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Members list & Invite portal */}
          <div className="lg:col-span-8 space-y-6">
            {activeWorkspace ? (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 shadow-xl">
                
                {/* Active workspace header details */}
                <div className="flex justify-between items-start border-b border-zinc-900 pb-4">
                  <div className="space-y-1 text-right">
                    <h3 className="text-base font-black text-white">{activeWorkspace.name}</h3>
                    <p className="text-[10px] text-zinc-500">{isRtl ? `تاريخ الإنشاء: ${new Date(activeWorkspace.createdAt).toLocaleDateString()}` : `Created: ${new Date(activeWorkspace.createdAt).toLocaleDateString()}`}</p>
                  </div>
                  <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/15 px-3 py-1 rounded-full font-black">
                    {isRtl ? `دورك: ${translateRole(userRole)}` : `Your Role: ${userRole}`}
                  </span>
                </div>

                {/* Invite member subsection if User has admin privileges */}
                {isWorkspaceAdmin && (
                  <div className="bg-zinc-950/45 border border-zinc-900 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4.5 w-4.5 text-purple-400" />
                      <h4 className="text-xs font-black text-white">{isRtl ? "دعوة عضو جديد للانضمام للفريق" : "Invite New Member to Workspace"}</h4>
                    </div>

                    <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <Input
                          placeholder={isRtl ? "البريد الإلكتروني للعضو..." : "user@email.com"}
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          icon={<Mail className="h-4 w-4 text-zinc-600" />}
                          className="py-2.5 text-xs text-right"
                        />
                      </div>
                      
                      {/* Role drop selector */}
                      <div className="w-full sm:w-36 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-300">{isRtl ? "صلاحية العضو:" : "Member Role:"}</label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 rounded-lg p-2.5 outline-none transition-all duration-200 focus:border-primary-brand"
                        >
                          <option value="ADMIN">{isRtl ? "مدير (Admin)" : "Admin"}</option>
                          <option value="EDITOR">{isRtl ? "محرر (Editor)" : "Editor"}</option>
                          <option value="VIEWER">{isRtl ? "مشاهد (Viewer)" : "Viewer"}</option>
                        </select>
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isInviting || !inviteEmail}
                        className="py-2.5 px-6 text-xs font-bold w-full sm:w-auto"
                      >
                        {isInviting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          isRtl ? "إرسال الدعوة" : "Send Invitation"
                        )}
                      </Button>
                    </form>
                  </div>
                )}

                {/* Members table list */}
                <div className="space-y-3">
                  <span className="text-zinc-400 text-xs font-black block">{isRtl ? "أعضاء الفريق النشطين والدعوات المعلقة" : "Active Team Members & Pending Invites"}</span>
                  
                  <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950/20">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">{isRtl ? "البريد الإلكتروني" : "Email"}</TableHead>
                          <TableHead className="text-center">{isRtl ? "الصلاحية" : "Role"}</TableHead>
                          <TableHead className="text-center">{isRtl ? "حالة الانضمام" : "Status"}</TableHead>
                          {isWorkspaceAdmin && <TableHead className="text-center">{isRtl ? "إجراءات" : "Actions"}</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="text-zinc-200 text-xs font-bold text-right">{member.user?.email || "Pending Invite..."}</TableCell>
                            <TableCell className="text-center font-bold text-xs text-zinc-400">
                              <span className="inline-flex items-center gap-1">
                                <Shield className="h-3.5 w-3.5 text-purple-400" />
                                <span>{translateRole(member.role)}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                member.status === "ACCEPTED"
                                  ? "bg-green-500/10 text-green-400 border-green-500/15"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/15 animate-pulse"
                              }`}>
                                {member.status === "ACCEPTED" ? (isRtl ? "مقبول" : "Accepted") : (isRtl ? "معلق" : "Pending")}
                              </span>
                            </TableCell>
                            {isWorkspaceAdmin && (
                              <TableCell className="text-center">
                                {member.userId !== user?.id && member.role !== "OWNER" && (
                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    disabled={isActionLoading === member.id}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 border border-transparent hover:border-zinc-850 hover:bg-zinc-950/60 rounded-lg transition-colors cursor-pointer"
                                    title={isRtl ? "حذف العضو" : "Remove member"}
                                  >
                                    {isActionLoading === member.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UserX className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-20 border border-zinc-900 border-dashed rounded-3xl text-xs text-zinc-500 font-mono">
                {isRtl ? "برجاء اختيار أو إنشاء مساحة عمل للبدء." : "Please select or create a workspace to view members."}
              </div>
            )}
          </div>

        </section>

      </main>
    </div>
  );
}
