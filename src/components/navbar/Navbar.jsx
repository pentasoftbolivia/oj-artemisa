import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Menu, ChevronDown } from "lucide-react";
import { useNavbar } from "./useNavbar";

/**
 * Navbar component that provides the main navigation for the application.
 * It includes both desktop and mobile views with responsive design.
 *
 * @component
 * @example
 * return <Navbar />
 */

export const Navbar = () => {
  const navigate = useNavigate();
  const {
    isMenuOpen,
    setIsMenuOpen,
    activeDropdown,
    dropdownRef,
    user,
    navItems,
    location,
    onLogout,
  } = useNavbar();

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label="Navegación principal"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center space-x-2 transition-transform hover:scale-105"
            aria-label="Ir a la página de inicio"
          >
            <img
              src="/logo.png"
              alt="Órgano Judicial - La Paz"
              className="h-14 w-auto ml-[0.5cm]"
            />
          </Link>

          {/* Desktop Navigation */}
          <div
            className="hidden md:flex items-center space-x-1"
            ref={dropdownRef}
          >
            {navItems.map((item) => (
              <div key={item.title} className="relative group">
                {item.submenu ? (
                  <DropdownMenu
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 h-10 px-4 group-hover:bg-accent focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-haspopup="menu"
                        aria-controls={`${item.title.toLowerCase()}-dropdown`}
                      >
                        {item.title}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            activeDropdown === item.title && "rotate-180"
                          )}
                          aria-hidden="true"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      id={`${item.title.toLowerCase()}-dropdown`}
                      align="end"
                      className="w-48 py-2 focus:outline-none"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                      role="menu"
                      aria-label={`${item.title} submenu`}
                    >
                      {item.submenu.map((subItem) => (
                        <DropdownMenuItem
                          key={subItem.title}
                          onSelect={() => navigate(subItem.href)}
                        >
                          {subItem.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    asChild
                    className="h-10 px-4 hover:bg-accent focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <Link
                      to={item.href}
                      className="focus:outline-none"
                      aria-current={
                        location.pathname === item.href ? "page" : undefined
                      }
                    >
                      {item.title}
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Logout */}
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" asChild>
              <a href="#!" onClick={onLogout}>
                {/* {user?.displayName ? `Salir (${user.displayName})` : "Salir"} */}
                {user?.email ? `Salir (${user.email})` : "Salir"}
              </a>
            </Button>
          </div>

          {/* Mobile Menu Trigger */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={
                  isMenuOpen
                    ? "Cerrar menú de navegación"
                    : "Abrir menú de navegación"
                }
                aria-expanded={isMenuOpen}
                aria-controls="mobile-navigation"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] sm:w-[400px] focus:outline-none overflow-y-auto"
              id="mobile-navigation"
              aria-label="Menú de navegación móvil"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <SheetHeader>
                <SheetTitle className="text-left">Menú de usuario</SheetTitle>
                <SheetDescription className="sr-only">
                  Navegación principal y opciones de usuario.
                </SheetDescription>
              </SheetHeader>
              <div className="my-8 flex flex-col">
                <Accordion type="multiple" className="w-full">
                  {navItems.map((item) =>
                    !item.submenu ? (
                      <Link
                        key={item.title}
                        to={item.href}
                        className="flex flex-1 items-center justify-start py-4 font-medium transition-all hover:underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <AccordionItem value={item.title} key={item.title}>
                        <AccordionTrigger>{item.title}</AccordionTrigger>
                        <AccordionContent>
                          <div className="ml-4 flex flex-col gap-2 border-l-2 border-border pl-4">
                            {item.submenu.map((subItem) => (
                              <Link key={subItem.title} to={subItem.href} className="py-2 text-muted-foreground hover:text-foreground">
                                {subItem.title}
                              </Link>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  )}
                </Accordion>
                {/* Mobile Logout */}
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    asChild
                    className="w-full"
                    onClick={onLogout}
                  >
                    <a href="#!">Salir</a>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
