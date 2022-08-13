import clsx from "clsx";
import { useRouter } from "next/router";
import NextLink from "next/link";
import MuiLink from "@mui/material/Link";
import { styled } from "@mui/material/styles";
import { forwardRef, LegacyRef, Ref } from "react";
import { UrlObject } from "url";

// Add support for the sx prop for consistency with the other branches.
const Anchor = styled("a")({});

interface NextLinkComposedProps {
  to: string | UrlObject;
  linkAs?: UrlObject;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  prefetch?: boolean;
  locale?: string | false;
}

export const NextLinkComposed = forwardRef(function NextLinkComposed(
  props: NextLinkComposedProps,
  ref: Ref<HTMLAnchorElement>
) {
  const { to, linkAs, replace, scroll, shallow, prefetch, locale, ...other } =
    props;

  return (
    <NextLink
      href={to}
      prefetch={prefetch}
      as={linkAs}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      passHref
      locale={locale}
    >
      <Anchor ref={ref} {...other} />
    </NextLink>
  );
});

interface LinkProps extends NextLinkComposedProps {
  href: string | UrlObject;
  activeClassName?: string;
  as?: UrlObject;
  className?: string;
  noLinkStyle?: boolean;
  role?: string;
}

// A styled version of the Next.js Link component:
// https://nextjs.org/docs/api-reference/next/link
const Link = forwardRef(function Link(
  props: LinkProps,
  ref: Ref<HTMLAnchorElement>
) {
  const {
    activeClassName = "active",
    as,
    className: classNameProps,
    href,
    linkAs: linkAsProp,
    locale,
    noLinkStyle,
    prefetch,
    replace,
    role, // Link don't have roles.
    scroll,
    shallow,
    ...other
  } = props;

  const router = useRouter();
  const pathname = typeof href === "string" ? href : href.pathname;
  const className = clsx(classNameProps, {
    [activeClassName]: router.pathname === pathname && activeClassName,
  });

  const isExternal =
    typeof href === "string" &&
    (href.indexOf("http") === 0 || href.indexOf("mailto:") === 0);

  if (isExternal) {
    if (noLinkStyle) {
      return <Anchor className={className} href={href} ref={ref} {...other} />;
    }

    return (
      <MuiLink
        ref={ref}
        component={NextLinkComposed}
        className={className}
        href={href}
        {...other}
      />
    );
  }

  const linkAs = linkAsProp || as;

  const nextjsProps = {
    to: href,
    linkAs,
    replace,
    scroll,
    shallow,
    prefetch,
    locale,
  };

  if (noLinkStyle) {
    return <NextLinkComposed ref={ref} {...nextjsProps} {...other} />;
  }

  return (
    <MuiLink
      ref={ref}
      component={NextLinkComposed}
      className={className}
      {...nextjsProps}
      {...other}
    />
  );
});

export default Link;
