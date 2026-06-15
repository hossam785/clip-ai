import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async createWorkspace(userId: string, name: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const planName = user.subscription?.plan || 'FREE';
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    
    const currentOwned = await this.prisma.workspace.count({ where: { ownerId: userId } });
    const maxWorkspaces = planName === 'FREE' ? 1 : planName === 'STARTER' ? 3 : 10;
    if (currentOwned >= maxWorkspaces) {
      throw new BadRequestException(`Workspace limit reached! Your current plan (${planName}) allows up to ${maxWorkspaces} workspaces.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      return workspace;
    });
  }

  async inviteMember(userId: string, workspaceId: string, memberEmail: string, role: string) {
    await this.verifyWorkspacePermission(userId, workspaceId, 'ADMIN');

    const invitedUser = await this.prisma.user.findUnique({ where: { email: memberEmail } });
    if (!invitedUser) throw new NotFoundException('Invited user email does not exist.');

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const owner = await this.prisma.user.findUnique({
      where: { id: workspace.ownerId },
      include: { subscription: true },
    });
    const planName = owner?.subscription?.plan || 'FREE';
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    const limit = plan?.teamMemberLimit ?? 1;

    const currentMembers = await this.prisma.workspaceMember.count({ where: { workspaceId } });
    if (currentMembers >= limit) {
      throw new BadRequestException(`Team member limit reached! Workspace owner's plan (${planName}) allows up to ${limit} members.`);
    }

    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: invitedUser.id },
    });
    if (existing) throw new BadRequestException('User is already invited or a member of this workspace.');

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: invitedUser.id,
        role,
        status: 'INVITED',
      },
    });
  }

  async getMyInvitations(userId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { userId, status: 'INVITED' },
      include: { workspace: true },
    });
  }

  async acceptInvitation(userId: string, memberId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!membership) throw new NotFoundException('Invitation not found');
    if (membership.userId !== userId) throw new ForbiddenException('Not authorized');

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { status: 'ACTIVE' },
    });
  }

  async getWorkspaceMembers(userId: string, workspaceId: string) {
    await this.verifyWorkspacePermission(userId, workspaceId, 'VIEWER');

    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }

  async getMyWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, projects: true } },
          },
        },
      },
    });
    return memberships.map(m => ({
      ...m.workspace,
      myRole: m.role,
    }));
  }

  async removeMember(userId: string, workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'OWNER') throw new BadRequestException('Cannot remove owner of workspace');

    await this.verifyWorkspacePermission(userId, workspaceId, 'ADMIN');

    return this.prisma.workspaceMember.delete({ where: { id: memberId } });
  }

  async verifyWorkspacePermission(userId: string, workspaceId: string, requiredRole: string): Promise<boolean> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: 'ACTIVE' },
    });
    if (!member) throw new ForbiddenException('You are not a member of this workspace');

    const roleOrder = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];
    const userRoleIdx = roleOrder.indexOf(member.role);
    const requiredRoleIdx = roleOrder.indexOf(requiredRole);

    if (userRoleIdx < requiredRoleIdx) {
      throw new ForbiddenException(`Access denied! Requires at least role: ${requiredRole}`);
    }

    return true;
  }
}
