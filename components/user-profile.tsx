"use client"

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LoginDialog, RegisterDialog, ForgotPasswordDialog } from './auth-dialogs'

export function UserProfile() {
  const { user, logout } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSwitchToRegister = () => {
    setLoginOpen(false)
    setRegisterOpen(true)
  }

  const handleSwitchToLogin = () => {
    setRegisterOpen(false)
    setForgotPasswordOpen(false)
    setLoginOpen(true)
  }

  const handleSwitchToForgotPassword = () => {
    setLoginOpen(false)
    setForgotPasswordOpen(true)
  }

  if (!user) {
    return (
      <>
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background p-3 space-y-2">
          <div className="text-sm text-muted-foreground text-center mb-2">
            Sign in to sync your notes
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setLoginOpen(true)}
            >
              Sign In
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => setRegisterOpen(true)}
            >
              Sign Up
            </Button>
          </div>
        </div>

        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          onSwitchToRegister={handleSwitchToRegister}
          onSwitchToForgotPassword={handleSwitchToForgotPassword}
        />
        <RegisterDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onSwitchToLogin={handleSwitchToLogin}
        />
        <ForgotPasswordDialog
          open={forgotPasswordOpen}
          onOpenChange={setForgotPasswordOpen}
          onBack={handleSwitchToLogin}
        />
      </>
    )
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 border-t bg-background">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 p-3 h-auto hover:bg-accent"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
              <AvatarFallback className="text-xs">
                {getInitials(user.username)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-sm font-medium truncate">{user.username}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
