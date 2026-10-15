                      origin-left
                      bg-[#F7941D]

                      transition-transform
                      duration-300
                      ease-out

                      ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}
                    `}
                  />
                </Link>
              );
            })}

            {/* =====================================================
                MOBILE CONTACT LINK
                ===================================================== */}
            {(() => {
              const active = isNavActive("/contact");

              return (
                <Link
                  to="/contact"
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`
                    group
                    relative
                    flex
                    items-center
                    py-3
                    text-sm
                    font-semibold

                    transition-all
                    duration-300
                    ease-out

                    ${
                      active
                        ? "text-[#F7941D]"
                        : `
                          text-foreground/80
                          hover:translate-x-1
                          hover:text-[#F7941D]
                        `
                    }
                  `}
                >
                  <span
                    className="
                      transition-transform
                      duration-300
                      ease-out
                      group-hover:scale-[1.02]
                    "
                  >
                    Contact
                  </span>

                  <span
                    aria-hidden="true"
                    className={`
                      absolute
                      inset-x-0
                      bottom-0
                      h-[2px]
                      origin-left
                      bg-[#F7941D]

                      transition-transform
                      duration-300
                      ease-out

                      ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}
                    `}
                  />
                </Link>
              );
            })()}
          </div>
        </nav>
      )}

      {/* =====================================================
          SIGN-IN DRAWER
          ===================================================== */}
      <Sheet open={signInOpen} onOpenChange={setSignInOpen}>
        {signInOpen && (
          <style>{`
            #chat-widget-container,
            #lc_chat_widget,
            chat-widget,
            iframe[src*="leadconnectorhq.com"],
            iframe[src*="leadconnector"] {
              display: none !important;
            }
          `}</style>
        )}

        <SheetContent
          side="right"
          className="
            z-[100]
            w-[min(100%,380px)]
            overflow-y-auto
            p-6
            sm:max-w-md
          "
        >
          <SignInSheet />
        </SheetContent>
      </Sheet>
    </header>
  );
}
