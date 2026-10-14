import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export const ADMIN_ROLES = ['ADMIN', 'REST_ADMIN', 'MANAGER'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
    const user = context.switchToHttp().getRequest().user;
    if (!user?.restaurantId || (roles && !roles.includes(user.role))) {
      throw new ForbiddenException('Insufficient restaurant permissions');
    }
    return true;
  }
}
