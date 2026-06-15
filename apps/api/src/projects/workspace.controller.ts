import { Controller, Get, Post, Delete, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Get()
  getMyWorkspaces(@CurrentUser() user: any) {
    return this.workspaceService.getMyWorkspaces(user.id);
  }

  @Post()
  createWorkspace(
    @Body() body: { name: string },
    @CurrentUser() user: any,
  ) {
    return this.workspaceService.createWorkspace(user.id, body.name);
  }

  @Get('invitations')
  getMyInvitations(@CurrentUser() user: any) {
    return this.workspaceService.getMyInvitations(user.id);
  }

  @Post('invitations/:id/accept')
  acceptInvitation(
    @Param('id') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.workspaceService.acceptInvitation(user.id, memberId);
  }

  @Get(':id/members')
  getMembers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: any,
  ) {
    return this.workspaceService.getWorkspaceMembers(user.id, workspaceId);
  }

  @Post(':id/invite')
  inviteMember(
    @Param('id') workspaceId: string,
    @Body() body: { email: string; role: string },
    @CurrentUser() user: any,
  ) {
    return this.workspaceService.inviteMember(user.id, workspaceId, body.email, body.role);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.workspaceService.removeMember(user.id, workspaceId, memberId);
  }
}
