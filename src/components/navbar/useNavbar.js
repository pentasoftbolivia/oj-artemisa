import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "@/store/auth/authSlice";
import { supabase } from "@/lib/supabase";
import { selectUser } from "@/store/auth/authSlice";
import { DEFAULT_NAV_ITEMS } from "@/config/navigation";

const useNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = DEFAULT_NAV_ITEMS;

  const onLogout = useCallback(
    (e) => {
      e.preventDefault();
      localStorage.removeItem("user");
      localStorage.removeItem("lastPath");
      dispatch(logout());
      supabase.auth.signOut();
      requestAnimationFrame(() => {
        navigate("/auth/activosfijos", {
          replace: true,
          state: { from: "logout" },
        });
      });
    },
    [dispatch, navigate],
  );

  useEffect(() => {
    if (isMenuOpen) {
      closeMenu();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  return {
    isMenuOpen,
    setIsMenuOpen,
    activeDropdown,
    dropdownRef,
    user,
    navItems,
    location,
    onLogout,
    closeMenu,
  };
};

export { useNavbar };
