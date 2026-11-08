import { activeLocale, fmtCurrency, fmtDate, fmtNumber, fmtRelative, useLanguageGeneration, useNavigate } from "@kirocrew/app-sdk";
import React, { Children, Fragment, cloneElement, createContext, createElement, isValidElement, memo, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, AppWindow, Archive, Braces, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Cloud, CloudOff, Code, Copy, Database, Download, FileText, FolderClosed, FolderInput, FolderOpen, FolderPlus, HardDrive, Image, KeyRound, LayoutDashboard, LayoutGrid, Library, Link2, List, MoreHorizontal, Pencil, Plus, Receipt, RefreshCw, Search, Shapes, Share2, ShieldCheck, Star, Trash2, TriangleAlert, Upload, Users, Wallet, X } from "lucide-react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
import { Badge, Btn, Card, CardTitle, Clickable as ui_default$2, ContentSkeleton, EmptyState, ErrorNotice as ui_default$1, Input, MarkdownRenderer, SearchInput, SegmentedControl as ui_default, Skeleton, StatCard, Toggle } from "@kirocrew/app-sdk/ui";
// src/host/router.ts
/**
* The page's sub-routes (`/aws-control/usage`, `/aws-control/drive`, ...), without
* the dashboard's router.
*
* react-router is the dashboard's, not the App SDK's, and the SDK's `useNavigate`
* takes a path only (no `replace`, no history state). The page addresses its panes
* in the built-in's spelling, `/aws-control/<pane>`, and this module maps that onto
* where the app is actually mounted:
*
* - an ADOPTED copy keeps the built-in's route (`/aws-control/*`, from Kiro Crew's
*   adoption pin), so the spelling is the real path and a bookmark still works;
* - a FRESH install lives at `/apps/aws-control`, whose route takes no sub-path, so
*   the pane rides in the query string instead (`/apps/aws-control?pane=usage`).
*
* A navigation writes the browser history entry the way the dashboard's router
* does (its `{usr, key, idx}` state shape) and then announces it with a
* `popstate`, which is the event the dashboard's router already reads its location
* from, so the host and this page agree on where the reader is. Back and forward
* are the browser's own.
*/
/** The built-in's path, which the page's own code names. */
var LEGACY_BASE = "/aws-control";
/** Where a fresh install of this app is mounted. */
var INSTALLED_BASE = "/apps/aws-control";
/** The query parameter a fresh install carries its pane in. */
var PANE_PARAM = "pane";
function onLegacyRoute() {
	const { pathname } = window.location;
	return pathname === "/aws-control" || pathname.startsWith("/aws-control/");
}
/** The current location in the built-in's spelling: `/aws-control[/<pane>...]`. */
function currentPath() {
	if (onLegacyRoute()) return window.location.pathname;
	const pane = new URLSearchParams(window.location.search).get(PANE_PARAM);
	return pane ? `${LEGACY_BASE}/${pane}` : LEGACY_BASE;
}
/** The real URL for a path in the built-in's spelling, on this mount. */
function hrefFor(to) {
	if (!(to === "/aws-control" || to.startsWith("/aws-control/"))) return to;
	if (onLegacyRoute()) return to;
	const rest = to.slice(13);
	return rest ? `${INSTALLED_BASE}?${PANE_PARAM}=${encodeURIComponent(rest)}` : INSTALLED_BASE;
}
function subscribe$1(onChange) {
	window.addEventListener("popstate", onChange);
	return () => window.removeEventListener("popstate", onChange);
}
function snapshot() {
	return `${window.location.pathname}${window.location.search}`;
}
function useLocation() {
	useSyncExternalStore(subscribe$1, snapshot, snapshot);
	const raw = window.history.state;
	return {
		pathname: currentPath(),
		state: raw && typeof raw === "object" ? raw.usr ?? null : null
	};
}
function useNavigate$1() {
	return navigate;
}
function navigate(to, opts) {
	if (typeof to === "number") {
		window.history.go(to);
		return;
	}
	const previous = window.history.state;
	const idx = typeof previous?.idx === "number" ? previous.idx : 0;
	const state = {
		usr: opts?.state,
		key: Math.random().toString(36).slice(2, 10),
		idx: opts?.replace ? idx : idx + 1
	};
	const url = hrefFor(to);
	if (opts?.replace) window.history.replaceState(state, "", url);
	else window.history.pushState(state, "", url);
	window.dispatchEvent(new PopStateEvent("popstate", { state }));
}
/** A plain-click link to a dashboard route, through the host's own navigation. */
function Link({ to, onClick, ...rest }) {
	const hostNavigate = useNavigate();
	return createElement("a", {
		...rest,
		href: to,
		onClick: (event) => {
			onClick?.(event);
			if (event.defaultPrevented) return;
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			event.preventDefault();
			hostNavigate(to);
		}
	});
}
// src/host/appQuery.ts
/**
* `useAppQuery` / `useAppQueryKey`, the app-namespaced query cache.
*
* The dashboard's own hooks take the namespace from the host's identity context,
* which grants one to built-in pages only, and are not on the App SDK. These keep
* the built-in's keys exactly (`['aws-control', ...key]`), so the page's own
* invalidations still match its queries, over the host's shared `@tanstack/react-query`.
*/
var APP_ID$1 = "aws-control";
function resolveAppQueryKey(key) {
	if (key.length > 0 && key[0] === "aws-control") return key;
	return [APP_ID$1, ...key];
}
function useAppQueryKey() {
	return useCallback((key) => resolveAppQueryKey(key), []);
}
function useAppQuery(key, options) {
	return useQuery({
		...options,
		queryKey: resolveAppQueryKey(key)
	});
}
// src/host/i18n.ts
/**
* The app's own strings. A bundle cannot read the dashboard's catalogs (those
* belong to the host and change with it), so every locale the dashboard ships is
* bundled here and looked up against the host's active language.
*
* Lookup order: the exact locale (`pt`, `zh-CN`), then its base language, then
* English, then the key itself, so a missing translation shows English rather
* than nothing. `{{name}}` placeholders are filled from `vars`; one with no value
* is left as written.
*
* A numeric `count` picks a plural form the way the dashboard's i18next does:
* in each catalog of the chain, `<key>_zero` for 0 when it exists, then
* `<key>_<category>` for that catalog's own CLDR category (`one`, `few`,
* `many`, `other`; `Intl.PluralRules`), then the bare key. So `ru` reads its
* `_few` form for 3 while `ja` reads `_other` for every count.
*
* `t` reads the language at call time. The root component subscribes to the
* host's language changes (`useLanguageGeneration`), and its re-render reaches
* every child, so a language switch repaints the page without a reload.
*/
var CATALOGS = {
	bn: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"আপনার ক্লাউড অ্যাকাউন্টগুলো, সহজ ভাষায়। Kiro Crew ব্যবহার করতে পারে এমন প্রতিটি AWS অ্যাকাউন্ট দেখুন — প্রতিটির জন্য একটি স্বাস্থ্য-আলো এবং তার সাথে মানানসই পুনঃসংযোগের নির্দেশনা, সেই সাথে একটি S3-ভিত্তিক ক্লাউড ড্রাইভ — ফাইল, একটি ক্লাউড আর্টিফ্যাক্ট লাইব্রেরি ও ব্যাকআপ — এবং সময়সীমাবদ্ধ শেয়ার লিঙ্ক। আপনি না বললে কিছুই সর্বজনীন নয়, আর প্রতিটি অর্থপ্রদানকারী পরিষেবা বিল করার আগে আপনার নিশ্চিতকরণ চায়।\",\"display_name\":\"AWS Control\",\"highlight_1\":\"প্রতিটি অ্যাকাউন্টে একটি করে স্বাস্থ্য-আলো, প্রোফাইল যেভাবে প্রমাণীকরণ করে তার সাথে মানানসই পুনঃসংযোগ নির্দেশনাসহ।\",\"highlight_2\":\"ব্যক্তিগত, এনক্রিপ্ট করা, সংস্করণযুক্ত সঞ্চয়স্থান যা আপনি নিশ্চিত করার পরেই তৈরি হয়।\",\"highlight_3\":\"আপনার ক্লাউড আর্টিফ্যাক্ট লাইব্রেরি, ফাইল ও ব্যাকআপ সবই আপনার নিজের একটি বাকেটে থাকে।\",\"highlight_4\":\"শেয়ার লিঙ্ক সবসময় মেয়াদোত্তীর্ণ হয় — আপনি না বললে কিছুই সর্বজনীন নয়।\",\"highlight_5\":\"প্রতিটি অর্থপ্রদানকারী পরিষেবা প্রথম ব্যবহারের আগে প্রতি অ্যাকাউন্টে নিশ্চিত করা হয়, আর প্রতিটি পরিবর্তন নথিভুক্ত থাকে।\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Kiro Crew যে AWS অ্যাকাউন্টগুলিতে পৌঁছাতে পারে, কোনগুলি সুস্থ আছে এবং এই মাসে কত খরচ হচ্ছে — AWS কনসোল না খুলেই সব দেখুন।\",\"configuration_1\":\"এই মেশিনে ইতিমধ্যে থাকা প্রোফাইল থেকে একটি অ্যাকাউন্ট যোগ করুন, তারপর প্রথম ব্যবহারের আগে প্রতিটি সশুল্ক পরিষেবা অ্যাকাউন্ট অনুযায়ী একবার নিশ্চিত করুন।\"},\"console\":{\"copy\":\"কপি\",\"copied\":\"কপি হয়েছে\",\"close\":\"বন্ধ\",\"loading\":\"লোড হচ্ছে…\",\"download\":\"ডাউনলোড\",\"share\":\"শেয়ার\",\"delete\":\"মুছুন\",\"delete_failed\":\"মুছতে ব্যর্থ — ফাইল অপরিবর্তিত আছে। আবার চেষ্টা করুন।\",\"delete_failed_named\":\"“{{name}}” মুছে ফেলা যায়নি — ফাইলটি অপরিবর্তিত আছে। আবার চেষ্টা করুন।\",\"download_failed\":\"ডাউনলোড শুরু করা যায়নি। কিছুই পাঠানো হয়নি। আবার চেষ্টা করুন।\",\"delete_confirm_action\":\"ফাইল মুছুন\",\"delete_confirm\":\"“{{name}}” মুছবেন? ফাইলটি ড্রাইভ থেকে সরানো হবে।\",\"col_name\":\"নাম\",\"col_kind\":\"ধরন\",\"col_size\":\"আকার\",\"col_modified\":\"পরিবর্তিত\",\"col_actions\":\"অ্যাকশন\",\"kind_folder\":\"ফোল্ডার\",\"folder_new\":\"নতুন ফোল্ডার\",\"folder_name\":\"ফোল্ডারের নাম\",\"folder_delete_confirm\":\"“{{name}}” এবং এর ভেতরের সবকিছু মুছবেন?\",\"folder_delete_action\":\"ফোল্ডার মুছুন\",\"folder_delete_failed\":\"ফোল্ডারটি মুছে ফেলা যায়নি।\",\"folder_create_failed\":\"ফোল্ডারটি তৈরি করা যায়নি।\",\"folder_bad_name\":\"এই ফোল্ডারের নামে এমন অক্ষর আছে যা ড্রাইভ সংরক্ষণ করতে পারে না। অক্ষর, সংখ্যা, স্পেস এবং . _ - ( ) + @ = নিরাপদ।\",\"folder_deleted_one\":\"“{{name}}” মুছে ফেলা হয়েছে: {{count}}টি আইটেম।\",\"folder_deleted_other\":\"“{{name}}” মুছে ফেলা হয়েছে: {{count}}টি আইটেম।\",\"cancel\":\"বাতিল\",\"load_more\":\"আরও দেখুন\",\"stat_this_month\":\"এই মাসে\",\"storage_consent_needed\":\"এই অ্যাকাউন্টের ক্লাউড স্টোরেজ এখনো নিশ্চিত করা হয়নি। নিচে নিশ্চিত করে পৃষ্ঠাটি রিফ্রেশ করো।\",\"stat_stored_value\":\"{{size}} · {{objects}}টি আইটেম\",\"costs_as_of\":\"ক্যাশ করা পরিসংখ্যান, {{date}} পর্যন্ত।\",\"costs_consent_missing\":\"এই অ্যাকাউন্টের খরচ দেখতে নিচে খরচ প্রতিবেদন চালু করুন।\",\"costs_unavailable\":\"বিলের তথ্য এখন পড়া যাচ্ছে না।\",\"account_unavailable\":\"এই অ্যাকাউন্টে এখন পৌঁছানো যাচ্ছে না। পুনঃসংযোগ করুন, তারপর আবার আসুন।\",\"drive_status_failed\":\"ড্রাইভটি এখন পড়া যায়নি।\",\"setup_title\":\"একটি ক্লাউড ড্রাইভ সেট আপ করুন\",\"setup_body\":\"এটি আপনার নিজের অ্যাকাউন্টে একটি ব্যক্তিগত, এনক্রিপ্ট করা, সংস্করণযুক্ত সঞ্চয়স্থানের বাকেট তৈরি করে, আপনার ফাইল, আর্টিফ্যাক্ট লাইব্রেরি ও ব্যাকআপের জন্য।\",\"setup_searched_region\":\"কোনো ড্রাইভ পাওয়া যায়নি {{region}}-এ। শুধু এই অঞ্চলটি খোঁজা হয়েছে, তাই এই অ্যাকাউন্টের অন্য অঞ্চলের ড্রাইভ এখানে দেখা যাবে না।\",\"setup_costs_note\":\"খরচ ব্যবহারের সাথে চলে: আপনি যা সঞ্চয় করেন তার জন্য AWS-কে অর্থ দেন, এবং তার আগে কিছুই নয়।\",\"setup_preview_region\":\"অঞ্চল\",\"setup_preview_resource\":\"রিসোর্স\",\"setup_preview_btn\":\"প্রিভিউ\",\"setup_confirm_btn\":\"তৈরি করুন\",\"setup_creating\":\"তৈরি হচ্ছে…\",\"setup_error\":\"ড্রাইভ প্রস্তুত করা যায়নি। একটু পরে আবার চেষ্টা করুন।\",\"setup_confirm_error\":\"ড্রাইভ তৈরি করা যায়নি। কিছুই বদলানো হয়নি — নীচের অনুমতিগুলো দেখে আবার চেষ্টা করুন।\",\"setup_policy_error\":\"পেস্ট করার অনুমতিগুলো লোড করা যায়নি।\",\"setup_policy_label\":\"পেস্ট করার জন্য সঠিক অনুমতিগুলো দেখান\",\"library_all\":\"সব\",\"library_not_pushable\":\"ছবি এখনো ক্লাউডে যোগ করা যায় না।\",\"kind_widget\":\"উইজেট\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"টেক্সট\",\"kind_webapp\":\"ওয়েব অ্যাপ\",\"kind_image\":\"ছবি\",\"drive_title\":\"ড্রাইভ\",\"drive_upload\":\"আপলোড\",\"drive_uploading\":\"আপলোড হচ্ছে…\",\"drive_bad_name\":\"সেই ফাইলের নামে এমন অক্ষর আছে যা ড্রাইভ সংরক্ষণ করতে পারে না। অক্ষর, সংখ্যা, স্পেস এবং . _ - ( ) + @ = নিরাপদ।\",\"rename_bad_name\":\"সেই নামে এমন অক্ষর আছে যা ড্রাইভ সংরক্ষণ করতে পারে না। নামটি পরিবর্তন করে আবার চেষ্টা করুন।\",\"drive_bad_name_named\":\"“{{name}}” আপলোড করা যায়নি — নামে এমন অক্ষর আছে যা ড্রাইভ সংরক্ষণ করতে পারে না। অক্ষর, সংখ্যা, স্পেস এবং . _ - ( ) + @ = নিরাপদ।\",\"drive_upload_failed\":\"“{{name}}” আপলোড করা যায়নি। আবার চেষ্টা করুন।\",\"section_files\":\"ফাইল\",\"section_library\":\"আর্টিফ্যাক্ট লাইব্রেরি\",\"section_backup\":\"ব্যাকআপ\",\"share_title\":\"“{{name}}” শেয়ার করুন\",\"share_expiry\":\"লিঙ্ক মেয়াদোত্তীর্ণ হবে\",\"share_note\":\"নোট\",\"share_note_placeholder\":\"এই লিঙ্কটি কীসের জন্য?\",\"share_create\":\"লিঙ্ক তৈরি করুন\",\"share_creating\":\"তৈরি হচ্ছে…\",\"share_failed\":\"শেয়ার লিংক তৈরি করা যায়নি। কিছুই শেয়ার করা হয়নি।\",\"expiry_1h\":\"1 ঘণ্টা\",\"expiry_1d\":\"1 দিন\",\"expiry_7d\":\"7 দিন\",\"share_expires_note\":\"মেয়াদ শেষ হলে লিঙ্কটি কাজ করা বন্ধ করে দেয়, এবং এটি আগে বাতিল করা যায় না।\",\"share_credentials_caveat\":\"অ্যাকাউন্টের সাইন-ইন সেশন আগে শেষ হয়ে গেলে এটি আরও আগে কাজ করা বন্ধ করতে পারে।\",\"cli_drawer_label\":\"এটি যেখানে থাকে\",\"cli_drawer_hint\":\"এই ফাইলগুলো {{bucket}} বাকেটের {{prefix}}-এর অধীনে থাকে। এই কমান্ডটি আপনার শংসাপত্র আছে এমন একটি টার্মিনাল থেকে সেগুলো তালিকাভুক্ত করে।\",\"backup_title\":\"ব্যাকআপ\",\"backup_kind_snapshot\":\"মেমরি ও ওয়ার্কস্পেস\",\"backup_kind_sessions\":\"সেশন আর্কাইভ\",\"backup_last_run\":\"সর্বশেষ ব্যাকআপ {{when}} · {{size}}\",\"backup_never\":\"এখনও ব্যাকআপ করা হয়নি\",\"backup_never_recorded\":\"এখানে কোনো রান রেকর্ড করা হয়নি — আগের আর্কাইভ এখনও ড্রাইভে থাকতে পারে\",\"backup_remembered\":\"এই ইনস্টলের নথিভুক্ত আর্কাইভ: {{count}} · তালিকা দেখো\",\"backup_sessions_scope\":\"এই Kiro হোমের অধীনে থাকা প্রতিটি সেশনের CLI রিপ্লে লগ এতে অন্তর্ভুক্ত, শুধু {{productName}}-তে শুরু করা চ্যাট নয়।\",\"backup_run_now\":\"এখন ব্যাকআপ করুন\",\"backup_running\":\"ব্যাকআপ হচ্ছে…\",\"backup_failed\":\"শেষ ব্যাকআপ ব্যর্থ হয়েছে: {{reason}}\",\"backup_start_failed\":\"ব্যাকআপ শুরু করা যায়নি।\",\"backup_start_retry\":\"ব্যাকআপ শুরু করা যায়নি। আবার চেষ্টা করুন।\",\"backup_start_unavailable\":\"এই অ্যাপের জন্য ব্যাকআপ উপলব্ধ নয়। জব রানটাইম নিবন্ধিত আছে কিনা দেখুন।\",\"backup_start_consent\":\"এই অ্যাকাউন্টের জন্য S3 অ্যাক্সেস দিন, তারপর ব্যাকআপ শুরু করুন।\",\"backup_start_no_drive\":\"এই অ্যাকাউন্টে এখনও কোনো ড্রাইভ নেই। একটি তৈরি করুন, তারপর ব্যাকআপ শুরু করুন।\",\"backup_nightly\":\"প্রতি রাতে ব্যাকআপ করুন\",\"backup_nightly_hint\":\"দিনে একবার মেমরি ও ওয়ার্কস্পেসের স্ন্যাপশট নেয়।\",\"backup_nightly_blocked_other_account\":\"রাতের স্ন্যাপশট কেবল ডিফল্ট অ্যাকাউন্টের জন্য চলে, তাই এই অ্যাকাউন্টের জন্য কিছুই ব্যাকআপ হয় না।\",\"backup_nightly_sessions\":\"প্রতি রাতে সেশন ব্যাকআপ করো\",\"backup_nightly_sessions_hint\":\"দিনে একবার এই অ্যাকাউন্টের ড্রাইভে সেশন আর্কাইভ আপলোড করে। এতে তোমার কথোপকথন অপরিবর্তিত থাকে, কিছুই বাদ দেওয়া হয় না।\",\"backup_nightly_sessions_destination\":\"সেই ড্রাইভ এই AWS অ্যাকাউন্টের S3 স্টোরেজ, আর {{button}} একই জায়গায় আর্কাইভ পাঠায়।\",\"backup_nightly_sessions_blocked_host\":\"এই কম্পিউটার সেশন আর্কাইভ তৈরি করতে পারে না, তাই কিছুই আপলোড হয় না।\",\"backup_nightly_sessions_blocked_redaction\":\"বাইরে পাঠানোর সময় তথ্য মোছার সেটিং চালু আছে, কিন্তু সেশন আর্কাইভে সেটি এখনও করা যায় না, তাই কিছুই আপলোড হয় না।\",\"backup_nightly_sessions_blocked_other_account\":\"রাতের আপলোড কেবল ডিফল্ট অ্যাকাউন্টের জন্য চলে, তাই এই অ্যাকাউন্টের জন্য কিছুই আপলোড হয় না।\",\"backup_nightly_sessions_blocked_other\":\"এই কম্পিউটারে রাতের আপলোড আটকে আছে, তাই কিছুই আপলোড হয় না।\",\"backup_nightly_sessions_blocked_next\":\"তুমি নিজে ব্যাকআপ শুরু করতে পারো।\",\"backup_nightly_sessions_blocked_next_redaction\":\"তুমি নিজে ব্যাকআপ শুরু করতে পারো, কিন্তু সেশন আর্কাইভ তথ্য না মুছে আপলোড হয়।\",\"backup_archive\":\"সঞ্চিত ব্যাকআপ\",\"backup_restore\":\"পুনরুদ্ধার\",\"backup_show_all_archives\":\"সব দেখাও ({{count}})\",\"backup_restore_caveat\":\"পুনরুদ্ধারের জন্য ব্যাকআপ ফোল্ডারে পড়ার অনুমতি প্রয়োজন। প্রস্তাবিত সর্বনিম্ন-অনুমতি নীতি ইচ্ছাকৃতভাবে শুধু লেখার অনুমতি দেয়, তাই অ্যাকাউন্টের ক্রেডেনশিয়াল আরও বিস্তৃত না হলে এটি প্রত্যাখ্যাত হবে।\",\"backup_remote_error\":\"সঞ্চিত ব্যাকআপগুলো এইমাত্র পড়া যায়নি।\",\"backup_status_failed\":\"ব্যাকআপের অবস্থা পড়া যায়নি।\",\"backup_nightly_failed\":\"“{{setting}}” বদলানো যায়নি। সেটিং অপরিবর্তিত।\",\"backup_restore_failed\":\"ওই ব্যাকআপটি পুনরুদ্ধার করা যায়নি। কিছুই লেখা হয়নি।\",\"backup_restored_note\":\"আপনার বর্তমান ডেটা প্রতিস্থাপন করা হয়নি। ব্যাকআপটি নিচের পথে একটি স্টেজিং ফোল্ডারে ডাউনলোড করা হয়েছে।\",\"backup_restore_recovered_note\":\"এই ইনস্টলেশনের নিজের আপলোডটি ডাউনলোড করা হয়েছে এবং তার রেকর্ডের সঙ্গে মিলিয়ে যাচাই করা হয়েছে। ড্রাইভে অন্য কিছু এটির ওপরে লিখে দিয়েছিল, এবং তোমার পরের আপলোডের সঙ্গেও তা করতে পারে। এই পেজে যে অন্য ইনস্টলেশনগুলো এই ড্রাইভে ব্যাকআপ করছে বলে দেখানো আছে, সেগুলো দিয়ে শুরু করো।\",\"backup_install\":\"এই ইনস্টলেশন\",\"backup_install_hint\":\"প্রতিটি ইনস্টলেশন নিজের নামে ব্যাকআপ রাখে, যাতে রিস্টোর করার সময় এই ইনস্টলেশনের আর্কাইভ অন্য ইনস্টলেশনের আর্কাইভ থেকে আলাদা করা যায়।\",\"backup_install_rename\":\"নাম বদলাও\",\"backup_install_save\":\"নাম সংরক্ষণ করো\",\"backup_install_rename_failed\":\"ইনস্টলেশনের নাম সংরক্ষণ করা যায়নি। এটি অপরিবর্তিত আছে।\",\"backup_install_name_label\":\"ইনস্টলেশনের নাম\",\"backup_attribution_self\":\"{{label}} · এই ইনস্টলেশন\",\"backup_attribution_self_unnamed\":\"এই ইনস্টলেশন\",\"backup_attribution_other\":\"\\\"{{label}}\\\" (অন্য একটি ইনস্টলেশন · {{id}})\",\"backup_attribution_other_unnamed\":\"অন্য একটি ইনস্টলেশন · {{id}}\",\"backup_attribution_unverified\":\"অযাচাইকৃত উৎস\",\"backup_origin_unknown\":\"অজানা উৎস\",\"backup_none_from_this_install\":\"এই ইনস্টলেশন থেকে কোনো ব্যাকআপ নেই। অন্যান্য ইনস্টলেশনের আর্কাইভ দেখতে সেগুলো অন্তর্ভুক্ত করো।\",\"backup_others_on_drive\":\"এই ড্রাইভে ব্যাকআপ নিচ্ছে এমন অন্যান্য ইনস্টলেশন: {{count}}\",\"backup_show_others\":\"অন্যান্য ইনস্টলেশনের আর্কাইভ অন্তর্ভুক্ত করো\",\"backup_others_truncated\":\"শুধু প্রথম {{max}}টি অন্যান্য ইনস্টলেশন দেখানো হয়েছে।\",\"backup_archives_truncated\":\"কিছু {{kind}} আর্কাইভ তালিকায় আনা যায়নি। সবচেয়ে নতুনগুলো হয়তো এখানে নেই।\",\"backup_shared_note\":\"দুটি ইনস্টলেশনের ভাগাভাগি করা একটি ড্রাইভ মানে ভাগ করা মেমরি নয় এবং ভাগ করা সেশনও নয়। প্রতিটি ব্যাকআপ একটি মুহূর্তের আলাদা আর্কাইভ, আর রিস্টোর শুধু সেই ফাইলটি একটি স্টেজিং ফোল্ডারে ডাউনলোড করে — ফাইলগুলো তুমি নিজেই প্রতিস্থাপন করো, gateway বন্ধ থাকা অবস্থায়।\",\"backup_restore_foreign_confirm\":\"এই আর্কাইভটি অন্য একটি ইনস্টলেশন ({{install}}) আপলোড করেছিল। এটি রিস্টোর করলে সেই ইনস্টলেশনের ডেটা ডাউনলোড হবে, এই ইনস্টলেশনের নয়। তবুও ডাউনলোড করবে?\",\"backup_restore_unverified_confirm\":\"এই আর্কাইভটি এই ইনস্টলেশনের নিজের ফোল্ডারেই আছে, কিন্তু এই ইনস্টলেশন এটি আপলোড করার কোনো রেকর্ড রাখে না। ড্রাইভে লিখতে পারে এমন যে কেউ ওই ফোল্ডার তৈরি করতে পারে, তাই এটি এই ইনস্টলেশনের নাও হতে পারে। তবুও ডাউনলোড করবে?\",\"backup_restore_unknown_confirm\":\"এই আর্কাইভটি ইনস্টলেশনগুলোর নাম দেওয়ার আগে আপলোড হয়েছিল, তাই কোন ইনস্টলেশন এটি লিখেছিল তা অজানা। তবুও ডাউনলোড করবে?\",\"backup_restore_overwritten_confirm\":\"এই আর্কাইভটি এই ইনস্টলেশনই আপলোড করেছিল, কিন্তু ড্রাইভে এখন আর সেই আপলোড করা বিষয়বস্তু নেই — এর পরে অন্য কিছু সেটির ওপরে লিখে দিয়েছে। তবুও ডাউনলোড করবে?\",\"backup_restore_overwritten_refused\":\"এই আর্কাইভটি এই ইনস্টলেশনই আপলোড করেছিল, কিন্তু ড্রাইভে এখন আর সেই আপলোড করা বিষয়বস্তু নেই। তবুও ডাউনলোড করতে সঞ্চিত ব্যাকআপ খুলে ডাউনলোড করো বেছে নাও।\",\"backup_restore_foreign_refused\":\"সেই আর্কাইভটি অন্য একটি ইনস্টলেশনের। তবুও ডাউনলোড করতে রিস্টোর নিশ্চিত করো।\",\"backup_restore_confirm_yes\":\"ডাউনলোড করো\",\"backup_restore_confirm_no\":\"বাতিল করো\",\"access_title\":\"শেয়ার লিঙ্ক\",\"access_empty\":\"কোনো সক্রিয় শেয়ার লিঙ্ক নেই।\",\"access_expires_in\":\"মেয়াদ শেষ {{when}}\",\"access_forget\":\"তালিকা থেকে সরান\",\"access_object_missing\":\"ফাইল মুছে ফেলা হয়েছে\",\"access_unchecked\":\"এই লিঙ্কগুলি ড্রাইভের সঙ্গে যাচাই করা হয়নি, তাই মুছে ফেলা ফাইল এখানে চিহ্নিত হয় না।\",\"access_footer\":\"তালিকা থেকে লিংক সরালে তা বাতিল হয় না — শেয়ার করা লিংক মেয়াদ শেষ না হওয়া পর্যন্ত কাজ করে।\",\"access_list_failed\":\"শেয়ার লিংকগুলো পড়া যায়নি।\",\"access_forget_failed\":\"ওই লিংকটি তালিকা থেকে সরানো যায়নি। এটি এখনও তালিকায় আছে।\",\"keys_count_one\":\"{{count}}টি কী\",\"keys_count_other\":\"{{count}}টি কী\",\"keys_for_account\":\"{{name}}-এর কী\",\"key_healthy\":\"সুস্থ\",\"parent_folders\":\"প্যারেন্ট ফোল্ডার\",\"folder_actions\":\"ফোল্ডারের কাজ\",\"file_actions\":\"ফাইলের কাজ\",\"root_storage_used\":\"স্টোরেজ কিসে যাচ্ছে\",\"root_section_objects_one\":\"{{objects}}টি আইটেম\",\"root_section_objects_other\":\"{{objects}}টি আইটেম\",\"view_grid\":\"গ্রিড ভিউ\",\"view_list\":\"তালিকা ভিউ\",\"library_add\":\"আর্টিফ্যাক্ট থেকে যোগ করুন\",\"library_add_one\":\"আর্টিফ্যাক্ট লাইব্রেরিতে যোগ করুন\",\"folder_open\":\"{{name}} ফোল্ডার খুলুন\",\"library_adding\":\"যোগ করা হচ্ছে…\",\"library_add_oneway\":\"এখানকার কপি ক্লাউড স্টোরেজ নেয়।\",\"library_add_again\":\"আবার যোগ করুন\",\"library_add_count\":\"আর্টিফ্যাক্ট থেকে যোগ করুন ({{count}}টি প্রস্তুত)\",\"library_add_nothing\":\"যোগ করার আর কিছু নেই - যা যোগ করা সম্ভব সব এখানেই আছে।\",\"library_list_failed\":\"ক্লাউডে কী আছে তা পড়া যায়নি।\",\"files_list_failed\":\"এই ফোল্ডারটি পড়া যায়নি।\",\"library_local_failed\":\"আপনার আর্টিফ্যাক্ট পড়া যায়নি।\",\"retry\":\"আবার চেষ্টা করুন\",\"library_add_none\":\"কোনো আর্টিফ্যাক্ট মেলেনি।\",\"library_update\":\"কপি আপডেট করুন\",\"library_search\":\"আপনার আর্টিফ্যাক্ট খুঁজুন\",\"library_push_failed\":\"এই আর্টিফ্যাক্ট যোগ করা যায়নি। আবার চেষ্টা করুন।\",\"library_blurb\":\"Kiro আপনার জন্য তৈরি করেছে এমন জিনিস, ক্লাউডে কপি করা। নিজে আপলোড করা ফাইল “ফাইল”-এ থাকে।\",\"library_empty_title\":\"এখনো ক্লাউডে কিছু কপি করা হয়নি\",\"library_empty_body\":\"এই ফোল্ডারে Kiro আপনার জন্য তৈরি করা জিনিস—উইজেট, পেজ, ডকুমেন্ট—থাকে, একবার আপনি সেগুলো ক্লাউডে কপি করলে। কম্পিউটার থেকে আপলোড করা ফাইল বরং “ফাইল”-এ রাখুন।\",\"library_cloud_only\":\"শুধু ক্লাউডে\",\"library_in_cloud\":\"ক্লাউডে আছে\",\"library_stale_preview\":\"ক্লাউডে আছে v{{version}}; প্রিভিউতে নতুন লোকাল কপি দেখানো হচ্ছে\",\"library_stale_list\":\"ক্লাউড কপি v{{version}}; স্থানীয় কপি আরো নতুন\",\"library_added\":\"{{when}} যোগ করা হয়েছে\",\"library_open\":\"আর্টিফ্যাক্টে {{name}} খুলুন\",\"files_empty_title\":\"“ফাইল” খালি\",\"files_empty_body\":\"এই ফোল্ডারে কম্পিউটার থেকে আপলোড করা ফাইল থাকে। এটি আর্টিফ্যাক্ট লাইব্রেরি থেকে আলাদা, যেখানে Kiro আপনার জন্য তৈরি করেছে এমন জিনিস থাকে।\",\"library_remove\":\"সরান\",\"library_remove_confirm\":\"“{{name}}” ক্লাউড লাইব্রেরি থেকে সরাবেন?\",\"library_remove_confirm_slug\":\"এটি ক্লাউড ফোল্ডার <folder>{{folder}}</folder> খালি করে।\",\"library_actions\":\"লাইব্রেরি আইটেমের ক্রিয়া\",\"library_remove_action\":\"কপি সরান\",\"library_removing\":\"সরানো হচ্ছে…\",\"library_remove_failed\":\"সরাতে ব্যর্থ — ক্লাউড কপি অপরিবর্তিত আছে। আবার চেষ্টা করুন।\",\"move_conflict\":\"গন্তব্য ফোল্ডারে এই নামের একটি ফাইল ইতিমধ্যে আছে। অন্য একটি ফোল্ডার বেছে নাও, অথবা আগে ফাইলটির নাম বদলাও।\",\"move_shared\":\"এই ফাইলের একটি সক্রিয় শেয়ার লিঙ্ক আছে — সরালে লিঙ্কটি অচল হয়ে যাবে। শেয়ারটি সরান (বা মেয়াদ শেষ হওয়া পর্যন্ত অপেক্ষা করুন) এবং আবার চেষ্টা করুন।\",\"rename\":\"নাম বদলান\",\"preview_truncated\":\"বড় ফাইল — শুধু শুরুর অংশ দেখানো হচ্ছে।\",\"preview_redacted\":\"এই প্রিভিউতে সংবেদনশীল মান ঢেকে রাখা হয়েছে।\",\"preview_unsupported\":\"এই ধরনের ফাইলের প্রিভিউ দেখা যায় না। দেখতে ডাউনলোড করুন।\",\"preview_failed\":\"প্রিভিউ লোড হয়নি। দেখতে ফাইলটি ডাউনলোড করুন, বা আবার চেষ্টা করুন।\",\"search_files\":\"ফাইলের নাম বা পাথ দিয়ে খুঁজুন…\",\"search_clear\":\"অনুসন্ধান মুছুন\",\"search_pending\":\"খোঁজা হচ্ছে…\",\"search_capped\":\"অনেক বেশি মিল — শুধু প্রথম {{count}}টি দেখানো হচ্ছে।\",\"search_failed\":\"অনুসন্ধান ব্যর্থ হয়েছে। আবার চেষ্টা করুন।\",\"search_goto\":\"ধারক ফোল্ডার খুলুন\",\"move_failed\":\"ফাইলটি সরানো যায়নি। আবার চেষ্টা করুন।\",\"rename_conflict\":\"এই নামের একটি ফাইল এখানে আগে থেকেই আছে।\",\"rename_shared\":\"এই ফাইলের একটি সক্রিয় শেয়ার লিঙ্ক আছে — নাম বদলালে লিঙ্কটি ভেঙে যাবে। শেয়ারটি সরান (বা মেয়াদ শেষ হতে দিন) এবং আবার চেষ্টা করুন।\",\"rename_failed\":\"ফাইলের নাম বদলানো যায়নি। আবার চেষ্টা করুন।\",\"rename_failed_named\":\"“{{name}}” এর নাম বদলানো যায়নি: {{reason}}\",\"library_add_empty\":\"এখনো কোনো আর্টিফ্যাক্ট নেই। Kiro আপনার জন্য যা তৈরি করবে তা এখানে দেখা যাবে, ক্লাউডে কপি করার জন্য প্রস্তুত।\",\"move_to\":\"ফোল্ডারে সরান…\",\"move_title\":\"“{{name}}” সরান\",\"move_root\":\"ফাইল (শীর্ষ স্তর)\",\"move_up\":\"উপরে {{name}}-এ\",\"move_no_folders\":\"এখানে সরানোর জন্য অন্য কোনো ফোল্ডার নেই। প্রথমে একটি তৈরি করুন।\",\"move_moving\":\"সরানো হচ্ছে…\",\"move_moving_picker\":\"সরানো হচ্ছে… এটি বন্ধ করলে সরানো বাতিল হবে না।\",\"move_to_busy\":\"আরেকটি সরানো এখনও চলছে\",\"move_ask_agent\":\"এই সরানো নিয়ে এজেন্টকে জিজ্ঞাসা করো\",\"stat_storage\":\"স্টোরেজ\",\"stat_objects\":\"অবজেক্ট\",\"key_needs_attention\":\"নজর দরকার\",\"backup_state_current\":\"ব্যাকআপ হয়েছে\",\"backup_state_never\":\"কখনো চলেনি\",\"costs_refresh_failed\":\"সর্বশেষ বিল পড়া ব্যর্থ হয়েছে; এটি ক্যাশ করা সংখ্যা।\"},\"page\":{\"refresh\":\"রিফ্রেশ করুন\",\"health_ok\":\"সুস্থ\",\"health_degraded\":\"মনোযোগ প্রয়োজন\",\"health_unknown\":\"অজানা\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"ক্রেডেনশিয়াল প্রসেস\",\"kind_other\":\"অন্যান্য\",\"default_profile\":\"ডিফল্ট প্রোফাইল\",\"not_connected_yet\":\"এখনও সংযুক্ত নয়\",\"reconnect\":\"পুনরায় সংযোগ\",\"reconnect_loading\":\"পুনরায় সংযোগের নির্দেশনা লোড হচ্ছে…\",\"reconnect_error\":\"পুনরায় সংযোগের নির্দেশনা লোড করা যায়নি।\",\"reconnect_hint_sso\":\"এই সংযোগ নবায়ন করতে আবার সাইন ইন করুন, তারপর এই পৃষ্ঠাটি রিফ্রেশ করুন।\",\"reconnect_hint_credential_process\":\"ক্রেডেনশিয়াল নবায়ন করতে আপনার টার্মিনালে এই কমান্ডটি চালান, তারপর এই পৃষ্ঠাটি রিফ্রেশ করুন।\",\"reconnect_hint_other\":\"সংযোগ পুনরুদ্ধার করতে আপনার টার্মিনালে এই কমান্ডটি চালান, তারপর এই পৃষ্ঠাটি রিফ্রেশ করুন।\",\"copy\":\"কপি করুন\",\"copied\":\"কপি হয়েছে\",\"empty_title\":\"এখনও কোনো অ্যাকাউন্ট নেই\",\"empty_body\":\"নিচে অ্যাকাউন্ট যোগ করুন-এ এই মেশিনের একটি AWS প্রোফাইল রেজিস্টার করুন, তার অ্যাকাউন্ট এখানে দেখা যাবে।\",\"error_title\":\"আপনার অ্যাকাউন্ট লোড করা যায়নি।\",\"error_body\":\"অ্যাকাউন্ট তালিকা পড়তে গিয়ে কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।\",\"error_forbidden_body\":\"এই ড্যাশবোর্ড সেশনটি মালিকের নয়, তাই এটি AWS অ্যাকাউন্ট পরিচালনা করতে পারে না। মালিক হিসেবে সাইন ইন করে আবার চেষ্টা করুন।\",\"retry\":\"আবার চেষ্টা করুন\",\"disabled_title\":\"AWS Control বন্ধ আছে\",\"disabled_body\":\"আপনার অ্যাকাউন্ট দেখতে App Store থেকে অ্যাপটি চালু করুন।\",\"aggregate_accounts_one\":\"{{count}}টি অ্যাকাউন্ট\",\"aggregate_accounts_other\":\"{{count}}টি অ্যাকাউন্ট\",\"aggregate_keys_one\":\"{{count}}টি কী\",\"aggregate_keys_other\":\"{{count}}টি কী\",\"aggregate_healthy_one\":\"{{count}}টি সুস্থ\",\"aggregate_healthy_other\":\"{{count}}টি সুস্থ\",\"keys_summary_one\":\"{{count}}টি কী\",\"keys_summary_other\":\"{{count}}টি কী\",\"add_accounts_title\":\"অ্যাকাউন্ট যোগ করুন\",\"add_accounts_summary\":\"এই মেশিনের আরও AWS প্রোফাইল নিবন্ধন করুন\",\"add_accounts_intro\":\"এই লোকাল AWS প্রোফাইলগুলি এখনও নিবন্ধিত নয়। আপনি যেগুলি যোগ করবেন, প্রতিটি তার অ্যাকাউন্টের অধীনে একটি কী হয়ে যাবে।\",\"add_accounts_search_placeholder\":\"প্রোফাইল খুঁজুন\",\"add_accounts_search_keeps_selected\":\"তুমি যে প্রোফাইলগুলো বেছে নিয়েছ, সেগুলো মিল না থাকলেও তালিকায় থেকে যায়।\",\"add_accounts_none\":\"সব লোকাল প্রোফাইল ইতিমধ্যেই নিবন্ধিত।\",\"add_accounts_no_profiles\":\"এই মেশিনে এখনও কোনো AWS প্রোফাইল নেই। আগে একটি তৈরি করো (যেমন, টার্মিনালে aws configure চালাও), তারপর এখানে নিবন্ধন করো।\",\"add_accounts_unsupported\":\"Windows-এ AWS Control এই মেশিনের AWS প্রোফাইলে পৌঁছাতে পারে না: AWS অ্যাকসেসের জন্য Linux বা macOS শেল দরকার। WSL (Windows Subsystem for Linux)-এ {{productName}} গেটওয়ে চালান, তারপর সেখানে সেট করা প্রোফাইলগুলো রেজিস্টার করুন।\",\"add_accounts_count_one\":\"{{max}}টির মধ্যে {{count}}টি নিবন্ধিত\",\"add_accounts_count_other\":\"{{max}}টির মধ্যে {{count}}টি নিবন্ধিত\",\"add_accounts_cap_reached\":\"আপনি {{max}}টি কী-র সীমায় পৌঁছেছেন। আরও যোগ করার আগে একটি সরান।\",\"add_accounts_register\":\"নির্বাচিতগুলি নিবন্ধন করুন\",\"add_accounts_registering\":\"নিবন্ধন করা হচ্ছে…\",\"add_accounts_error\":\"সেই প্রোফাইলগুলি নিবন্ধন করা যায়নি। কিছুই যোগ করা হয়নি। আবার চেষ্টা করুন।\",\"add_accounts_load_error\":\"স্থানীয় AWS প্রোফাইলগুলোর তালিকা করা যায়নি।\",\"search_placeholder\":\"অ্যাকাউন্ট খুঁজুন\",\"paid_services_title\":\"পেইড পরিষেবা\",\"orphan_consent\":\"এখানে নিবন্ধিত নয় এমন একটি AWS অ্যাকাউন্টের জন্য নিশ্চিত করা হয়েছে। নিচে নিশ্চিতকরণ প্রত্যাহার করুন, বা সেই অ্যাকাউন্টটি আবার নিবন্ধন করে তার নিজের পেজ থেকে পরিচালনা করুন।\",\"account_actions\":\"অ্যাকাউন্টের ক্রিয়া\",\"remove_account\":\"AWS Control থেকে সরান…\",\"remove_account_action\":\"সরান\",\"remove_account_confirm\":\"“{{name}}” AWS Control থেকে সরাবেন? AWS-এ বা আপনার AWS CLI কনফিগারেশনে কিছুই বদলাবে না।\",\"remove_account_error\":\"অ্যাকাউন্টটি সরানো যায়নি।\",\"remove_account_hint\":\"AWS-এ কিছুই বদলাবে না\",\"forget_key_confirm\":\"এই সারির কী “{{name}}” ভুলে যাবেন? AWS-এ বা আপনার AWS CLI কনফিগারেশনে কিছুই বদলাবে না।\",\"forget_key_action\":\"কী ভুলে যান\",\"totals_summary_one\":\"{{accounts}} অ্যাকাউন্ট · {{keys}}\",\"totals_summary_other\":\"{{accounts}} অ্যাকাউন্ট · {{keys}}\",\"keys_healthy_one\":\"{{n}}টির মধ্যে {{healthy}}টি কী সুস্থ\",\"keys_healthy_other\":\"{{n}}টির মধ্যে {{healthy}}টি কী সুস্থ\"},\"rail\":{\"accounts\":\"অ্যাকাউন্ট ও ক্রেডেনশিয়াল\",\"nav\":\"AWS Control বিভাগ\",\"switch_account\":\"অ্যাকাউন্ট পরিবর্তন করুন\",\"usage\":\"ব্যবহার ও খরচ\",\"use_account\":\"এই অ্যাকাউন্টটি ব্যবহার করুন\"},\"overview\":{\"title\":\"ওভারভিউ\",\"subtitle\":\"আপনার এজেন্টরা যে অ্যাকাউন্ট, কী, ক্লাউড ড্রাইভ ও পেইড সার্ভিস ব্যবহার করতে পারে, সবের জন্য একটি ঘর।\",\"stat_accounts\":\"অ্যাকাউন্ট\",\"stat_accounts_attention_one\":\"{{count}}টি অ্যাকাউন্টে নজর দরকার\",\"stat_accounts_attention_other\":\"{{count}}টি অ্যাকাউন্টে নজর দরকার\",\"stat_accounts_all_ok\":\"সব ঠিক আছে\",\"stat_keys\":\"কী ঠিক আছে\",\"stat_keys_sub_one\":\"{{count}}টি কী নিবন্ধিত\",\"stat_keys_sub_other\":\"{{count}}টি কী নিবন্ধিত\",\"stat_drive\":\"ড্রাইভ ব্যবহৃত\",\"stat_drive_none\":\"এখনও ড্রাইভ নেই\",\"stat_spend\":\"এই মাসে এখন পর্যন্ত\",\"stat_spend_consent\":\"খরচের রিপোর্ট বন্ধ\",\"stat_shares_none\":\"কিছু শেয়ার করা নেই\",\"stat_shares_sub_one\":\"{{count}}টি সক্রিয় লিংক\",\"stat_shares_sub_other\":\"{{count}}টি সক্রিয় লিংক\",\"stat_backups_nightly\":\"প্রতি রাতে\",\"stat_backups_manual\":\"ম্যানুয়াল\",\"stat_backups_sub_nightly\":\"প্রতি রাতে চলে\",\"stat_backups_sub_manual\":\"কোনো সময়সূচি নেই\",\"accounts_title\":\"অ্যাকাউন্ট\",\"accounts_note\":\"এজেন্টরা এই কীগুলো ব্যবহার করে কিন্তু কখনো দেখে না; কী-এর কোনো অংশ চ্যাটে আসে না।\",\"add_account\":\"অ্যাকাউন্ট যোগ করুন\",\"drive_title\":\"ক্লাউড ড্রাইভ\",\"drive_bar_label\":\"{{size}} রাখা আছে: ফাইল, আর্টিফ্যাক্ট লাইব্রেরি ও ব্যাকআপ\",\"drive_empty_title\":\"এখনও ক্লাউড ড্রাইভ নেই\",\"drive_empty_body\":\"আপনার ফাইল, আর্টিফ্যাক্ট লাইব্রেরি ও ব্যাকআপের জন্য এই অ্যাকাউন্টে একটি প্রাইভেট, এনক্রিপ্টেড বাকেট তৈরি করুন।\",\"drive_setup\":\"ক্লাউড ড্রাইভ সেট করুন\",\"drive_bucket_label\":\"বাকেট\",\"stat_spend_scope\":\"এই অ্যাকাউন্টের AWS বিল\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "প্রথম অনুরোধের আগে AWS ব্যবহার নিশ্চিত করুন",
				"confirmed_title": "AWS ব্যবহার নিশ্চিত করা হয়েছে",
				"account_changed": "এটি অন্য একটি AWS অ্যাকাউন্টের জন্য নিশ্চিত করা হয়েছিল, তাই নিশ্চিতকরণ প্রত্যাহার করা হয়েছে। নিচের অ্যাকাউন্টটি দেখে আবার নিশ্চিত করুন।",
				"service": "পরিষেবা",
				"region": "অঞ্চল",
				"credential_source": "ক্রেডেনশিয়ালের উৎস",
				"aws_account": "AWS অ্যাকাউন্ট",
				"provider_default": "(প্রদানকারীর ডিফল্ট)",
				"unresolved_account": "সমাধান করা যায়নি",
				"billing_notice": "এটি একটি অর্থপ্রদানকারী AWS পরিষেবা। আপনি নিশ্চিত না করা পর্যন্ত কোনো অনুরোধ পাঠানো হয় না।",
				"confirm_button": "নিশ্চিত করুন এবং সক্রিয় করুন",
				"withdraw": "নিশ্চিতকরণ প্রত্যাহার করুন",
				"status_failed": "নিশ্চিতকরণের অবস্থা পড়া যায়নি।",
				"confirm_failed": "নিশ্চিতকরণ রেকর্ড করা হয়নি।",
				"withdraw_failed": "নিশ্চিতকরণ প্রত্যাহার করা হয়নি।",
				"retry": "আবার চেষ্টা করুন",
				"badge_confirmed": "নিশ্চিত",
				"badge_not_enabled": "চালু নেই",
				"confirmed_on": "{{date}} তারিখে নিশ্চিত",
				"billing_notice_short": "চার্জ হবে। আপনি নিশ্চিত করার আগে কিছু পাঠানো হয় না।",
				"pending_profile_hint": "নিশ্চিত করতে AWS প্রোফাইল লেখা শেষ করো।",
				"bedrock_kb_billing_short": "প্রতি সার্চে বিল: প্রতিটি Knowledge Base-এর জন্য একটি Bedrock Retrieve কল",
				"aws_pricing_link": "AWS মূল্য",
				"withdraw_effect": "প্রত্যাহার করলে এজেন্টরা এই সার্ভিস ব্যবহার বন্ধ করবে, যতক্ষণ না তুমি আবার নিশ্চিত করো।"
			},
			"ui": {
				"clear_filter": "ফিল্টার মুছুন",
				"no_matches_for": "কোনো মিল নেই",
				"no_noun_match": "কোনো {{noun}} মিলছে না"
			}
		}
	},
	de: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"Ihre Cloud-Konten, verständlich erklärt. Sehen Sie jedes AWS-Konto, das Kiro Crew nutzen kann, mit einer Statusanzeige pro Konto und passender Anleitung zum erneuten Verbinden, dazu ein Cloud-Laufwerk auf S3-Basis — Dateien, eine Cloud-Artefaktbibliothek und Sicherungen — mit zeitlich begrenzten Freigabelinks. Nichts ist öffentlich, sofern Sie es nicht ausdrücklich festlegen, und jeder kostenpflichtige Dienst fragt vor jeder Abrechnung nach Ihrer Bestätigung.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"Eine Statusanzeige pro Konto, jeweils mit einer Anleitung zum erneuten Verbinden, die zur Authentifizierungsart des Profils passt\",\"highlight_2\":\"Privater, verschlüsselter, versionierter Speicher, der erst nach Ihrer Bestätigung erstellt wird\",\"highlight_3\":\"Ihre Cloud-Artefaktbibliothek, Dateien und Sicherungen liegen alle in einem Bucket, der Ihnen gehört\",\"highlight_4\":\"Freigabelinks laufen immer ab — nichts ist öffentlich, sofern Sie es nicht ausdrücklich festlegen\",\"highlight_5\":\"Jeder kostenpflichtige Dienst wird pro Konto vor der ersten Nutzung bestätigt, und jede Änderung wird dokumentiert\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Sieh jedes AWS-Konto, das Kiro Crew erreichen kann, welche davon gesund sind und was dich dieser Monat kostet -- ohne die AWS-Konsole zu öffnen.\",\"configuration_1\":\"Füge ein Konto aus den Profilen hinzu, die schon auf diesem Rechner liegen, und bestätige dann jeden kostenpflichtigen Dienst einmal pro Konto, bevor er zum ersten Mal genutzt wird.\"},\"console\":{\"copy\":\"Kopieren\",\"copied\":\"Kopiert\",\"close\":\"Schließen\",\"loading\":\"Wird geladen…\",\"download\":\"Herunterladen\",\"share\":\"Teilen\",\"delete\":\"Löschen\",\"delete_failed\":\"Löschen fehlgeschlagen — die Datei ist unverändert. Erneut versuchen.\",\"delete_failed_named\":\"„{{name}}“ konnte nicht gelöscht werden – die Datei ist unverändert. Versuchen Sie es erneut.\",\"download_failed\":\"Der Download konnte nicht gestartet werden. Es wurde nichts gesendet. Versuchen Sie es erneut.\",\"delete_confirm_action\":\"Datei löschen\",\"delete_confirm\":\"„{{name}}“ löschen? Die Datei wird aus dem Drive entfernt.\",\"col_name\":\"Name\",\"col_kind\":\"Art\",\"col_size\":\"Größe\",\"col_modified\":\"Geändert\",\"col_actions\":\"Aktionen\",\"kind_folder\":\"Ordner\",\"folder_new\":\"Neuer Ordner\",\"folder_name\":\"Ordnername\",\"folder_delete_confirm\":\"„{{name}}“ und den gesamten Inhalt löschen?\",\"folder_delete_action\":\"Ordner löschen\",\"folder_delete_failed\":\"Der Ordner konnte nicht gelöscht werden.\",\"folder_create_failed\":\"Der Ordner konnte nicht erstellt werden.\",\"folder_bad_name\":\"Dieser Ordnername enthält Zeichen, die das Laufwerk nicht speichern kann. Buchstaben, Ziffern, Leerzeichen und . _ - ( ) + @ = sind sicher.\",\"folder_deleted_one\":\"„{{name}}“ gelöscht: {{count}} Element.\",\"folder_deleted_other\":\"„{{name}}“ gelöscht: {{count}} Elemente.\",\"cancel\":\"Abbrechen\",\"load_more\":\"Mehr laden\",\"stat_this_month\":\"Diesen Monat\",\"storage_consent_needed\":\"Der Cloud-Speicher für dieses Konto ist noch nicht bestätigt. Bestätigen Sie ihn unten und aktualisieren Sie dann die Seite.\",\"stat_stored_value\":\"{{size}} · {{objects}} Elemente\",\"costs_as_of\":\"Zwischengespeicherte Zahlen, Stand {{date}}.\",\"costs_consent_missing\":\"Aktivieren Sie unten die Kostenberichte, um die Ausgaben dieses Kontos zu sehen.\",\"costs_unavailable\":\"Die Rechnungsdaten konnten gerade nicht gelesen werden.\",\"account_unavailable\":\"Dieses Konto ist derzeit nicht erreichbar. Verbinden Sie es erneut und kommen Sie dann zurück.\",\"drive_status_failed\":\"Das Laufwerk konnte gerade nicht gelesen werden.\",\"setup_title\":\"Ein Cloud-Laufwerk einrichten\",\"setup_body\":\"Damit wird ein privater, verschlüsselter, versionierter Speicher-Bucket in Ihrem eigenen Konto erstellt — für Ihre Dateien, Ihre Artefaktbibliothek und Ihre Sicherungen.\",\"setup_searched_region\":\"Kein Laufwerk in {{region}} gefunden. Nur diese Region wurde durchsucht, daher erscheint ein Laufwerk in einer anderen Region dieses Kontos hier nicht.\",\"setup_costs_note\":\"Die Kosten richten sich nach der Nutzung: Sie zahlen AWS für das, was Sie speichern, und vorher nichts.\",\"setup_preview_region\":\"Region\",\"setup_preview_resource\":\"Ressource\",\"setup_preview_btn\":\"Vorschau\",\"setup_confirm_btn\":\"Erstellen\",\"setup_creating\":\"Wird erstellt…\",\"setup_error\":\"Das Laufwerk konnte nicht vorbereitet werden. Versuchen Sie es gleich noch einmal.\",\"setup_confirm_error\":\"Das Laufwerk konnte nicht erstellt werden. Es wurde nichts geändert – prüfen Sie die Berechtigungen unten und versuchen Sie es erneut.\",\"setup_policy_error\":\"Die einzufügenden Berechtigungen konnten nicht geladen werden.\",\"setup_policy_label\":\"Die genauen Berechtigungen zum Einfügen anzeigen\",\"library_all\":\"Alle\",\"library_not_pushable\":\"Bilder können noch nicht in die Cloud kopiert werden.\",\"kind_widget\":\"Widget\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Text\",\"kind_webapp\":\"Web-App\",\"kind_image\":\"Bild\",\"drive_title\":\"Laufwerk\",\"drive_upload\":\"Hochladen\",\"drive_uploading\":\"Wird hochgeladen…\",\"drive_bad_name\":\"Dieser Dateiname enthält Zeichen, die das Laufwerk nicht speichern kann. Buchstaben, Ziffern, Leerzeichen und . _ - ( ) + @ = sind sicher.\",\"rename_bad_name\":\"Dieser Name enthält Zeichen, die das Laufwerk nicht speichern kann. Ändern Sie den Namen und versuchen Sie es erneut.\",\"drive_bad_name_named\":\"„{{name}}“ kann nicht hochgeladen werden — der Name enthält Zeichen, die das Laufwerk nicht speichern kann. Buchstaben, Ziffern, Leerzeichen und . _ - ( ) + @ = sind sicher.\",\"drive_upload_failed\":\"„{{name}}“ konnte nicht hochgeladen werden. Versuchen Sie es erneut.\",\"section_files\":\"Dateien\",\"section_library\":\"Artefakt-Bibliothek\",\"section_backup\":\"Sicherung\",\"share_title\":\"„{{name}}“ teilen\",\"share_expiry\":\"Link läuft ab nach\",\"share_note\":\"Notiz\",\"share_note_placeholder\":\"Wofür ist dieser Link?\",\"share_create\":\"Link erstellen\",\"share_creating\":\"Wird erstellt…\",\"share_failed\":\"Der Freigabelink konnte nicht erstellt werden. Es wurde nichts freigegeben.\",\"expiry_1h\":\"1 Stunde\",\"expiry_1d\":\"1 Tag\",\"expiry_7d\":\"7 Tage\",\"share_expires_note\":\"Der Link funktioniert nach dem Ablauf nicht mehr und kann nicht früher zurückgezogen werden.\",\"share_credentials_caveat\":\"Er funktioniert möglicherweise früher nicht mehr, wenn die Anmeldesitzung des Kontos zuvor endet.\",\"cli_drawer_label\":\"Wo dies liegt\",\"cli_drawer_hint\":\"Diese Dateien liegen unter {{prefix}} im Bucket {{bucket}}. Dieser Befehl listet sie in einem Terminal auf, das über Ihre Anmeldedaten verfügt.\",\"backup_title\":\"Sicherung\",\"backup_kind_snapshot\":\"Speicher & Arbeitsbereich\",\"backup_kind_sessions\":\"Sitzungsarchiv\",\"backup_last_run\":\"Zuletzt gesichert {{when}} · {{size}}\",\"backup_never\":\"Noch nicht gesichert\",\"backup_never_recorded\":\"Hier ist kein Lauf verzeichnet – frühere Archive liegen möglicherweise noch auf dem Laufwerk\",\"backup_remembered\":\"Von dieser Installation erfasste Archive: {{count}} · Liste anzeigen\",\"backup_sessions_scope\":\"Enthält die CLI-Wiedergabeprotokolle jeder Sitzung unter diesem Kiro-Home, nicht nur der in {{productName}} gestarteten Chats.\",\"backup_run_now\":\"Jetzt sichern\",\"backup_running\":\"Wird gesichert…\",\"backup_failed\":\"Letzte Sicherung fehlgeschlagen: {{reason}}\",\"backup_start_failed\":\"Sicherung konnte nicht gestartet werden.\",\"backup_start_retry\":\"Sicherung konnte nicht gestartet werden. Bitte erneut versuchen.\",\"backup_start_unavailable\":\"Sicherungen sind für diese App nicht verfügbar. Prüfen Sie, ob die Job-Laufzeit registriert ist.\",\"backup_start_consent\":\"Erteilen Sie S3-Zugriff für dieses Konto und starten Sie die Sicherung dann.\",\"backup_start_no_drive\":\"Dieses Konto hat noch kein Laufwerk. Erstellen Sie eines und starten Sie die Sicherung dann.\",\"backup_nightly\":\"Jede Nacht sichern\",\"backup_nightly_hint\":\"Erstellt einmal täglich eine Sicherung von Speicher & Arbeitsbereich.\",\"backup_nightly_blocked_other_account\":\"Nächtliche Snapshots laufen nur für das Standardkonto, daher wird für dieses Konto nichts gesichert.\",\"backup_nightly_sessions\":\"Sitzungen jede Nacht sichern\",\"backup_nightly_sessions_hint\":\"Lädt das Sitzungsarchiv einmal täglich auf das Laufwerk dieses Kontos hoch. Es enthält Ihre Unterhaltungen unverändert, es wird nichts entfernt.\",\"backup_nightly_sessions_destination\":\"Dieses Laufwerk ist S3-Speicher in diesem AWS-Konto, und {{button}} sendet das Archiv an denselben Ort.\",\"backup_nightly_sessions_blocked_host\":\"Dieser Computer kann das Sitzungsarchiv nicht erstellen, daher wird nichts hochgeladen.\",\"backup_nightly_sessions_blocked_redaction\":\"Die Bereinigung ausgehender Daten ist aktiv und das Sitzungsarchiv kann noch nicht bereinigt werden, daher wird nichts hochgeladen.\",\"backup_nightly_sessions_blocked_other_account\":\"Nächtliche Uploads laufen nur für das Standardkonto, daher wird für dieses Konto nichts hochgeladen.\",\"backup_nightly_sessions_blocked_other\":\"Nächtliche Uploads sind auf diesem Computer angehalten, daher wird nichts hochgeladen.\",\"backup_nightly_sessions_blocked_next\":\"Du kannst die Sicherung weiterhin selbst starten.\",\"backup_nightly_sessions_blocked_next_redaction\":\"Du kannst die Sicherung weiterhin selbst starten, dabei wird das Sitzungsarchiv aber ohne Bereinigung hochgeladen.\",\"backup_archive\":\"Gespeicherte Sicherungen\",\"backup_restore\":\"Wiederherstellen\",\"backup_show_all_archives\":\"Alle anzeigen ({{count}})\",\"backup_restore_caveat\":\"Für die Wiederherstellung ist Lesezugriff auf den Backup-Ordner erforderlich. Die empfohlene Richtlinie mit minimalen Rechten erteilt absichtlich nur Schreibzugriff, sodass sie abgelehnt wird, sofern die Anmeldedaten des Kontos nicht weiter gefasst sind.\",\"backup_remote_error\":\"Die gespeicherten Sicherungen konnten gerade nicht gelesen werden.\",\"backup_status_failed\":\"Der Sicherungsstatus konnte nicht gelesen werden.\",\"backup_nightly_failed\":\"„{{setting}}“ konnte nicht geändert werden. Die Einstellung ist unverändert.\",\"backup_restore_failed\":\"Diese Sicherung konnte nicht wiederhergestellt werden. Es wurde nichts geschrieben.\",\"backup_restored_note\":\"Ihre aktuellen Daten wurden nicht ersetzt. Die Sicherung wurde in einen Zwischenordner unter dem folgenden Pfad heruntergeladen.\",\"backup_restore_recovered_note\":\"Der eigene Upload dieser Installation wurde heruntergeladen und mit ihrer Aufzeichnung abgeglichen. Etwas anderes hatte ihn auf dem Laufwerk überschrieben und kann dasselbe mit deinem nächsten Upload tun. Fang bei den anderen Installationen an, die diese Seite als Sicherungen auf dieses Laufwerk auflistet.\",\"backup_install\":\"Diese Installation\",\"backup_install_hint\":\"Jede Installation speichert ihre Sicherungen unter ihrem eigenen Namen, damit eine Wiederherstellung die Archive dieser Installation von denen einer anderen Installation unterscheiden kann.\",\"backup_install_rename\":\"Umbenennen\",\"backup_install_save\":\"Namen speichern\",\"backup_install_rename_failed\":\"Der Installationsname konnte nicht gespeichert werden. Er ist unverändert.\",\"backup_install_name_label\":\"Installationsname\",\"backup_attribution_self\":\"{{label}} · diese Installation\",\"backup_attribution_self_unnamed\":\"diese Installation\",\"backup_attribution_other\":\"„{{label}}“ (eine andere Installation · {{id}})\",\"backup_attribution_other_unnamed\":\"eine andere Installation · {{id}}\",\"backup_attribution_unverified\":\"nicht verifizierter Ursprung\",\"backup_origin_unknown\":\"unbekannte Herkunft\",\"backup_none_from_this_install\":\"Keine Sicherungen von dieser Installation. Schließe Archive anderer Installationen ein, um deren anzuzeigen.\",\"backup_others_on_drive\":\"Andere Installationen, die auf dieses Laufwerk sichern: {{count}}\",\"backup_show_others\":\"Archive von anderen Installationen einschließen\",\"backup_others_truncated\":\"Es werden nur die ersten {{max}} anderen Installationen angezeigt.\",\"backup_archives_truncated\":\"Einige Archive vom Typ {{kind}} konnten nicht aufgelistet werden. Die neuesten fehlen hier möglicherweise.\",\"backup_shared_note\":\"Ein Laufwerk, das sich zwei Installationen teilen, bedeutet kein gemeinsames Gedächtnis und keine gemeinsamen Sitzungen. Jede Sicherung ist ein separates Archiv eines Zeitpunkts, und eine Wiederherstellung lädt diese Datei nur in einen Zwischenordner herunter — die Dateien ersetzt du selbst, bei gestopptem Gateway.\",\"backup_restore_foreign_confirm\":\"Dieses Archiv wurde von einer anderen Installation ({{install}}) hochgeladen. Es wiederherzustellen lädt die Daten jener Installation herunter, nicht die dieser Installation. Trotzdem herunterladen?\",\"backup_restore_unverified_confirm\":\"Dieses Archiv liegt im eigenen Ordner dieser Installation, aber diese Installation hat keinen Nachweis, es hochgeladen zu haben. Alles, was auf das Laufwerk schreiben kann, kann diesen Ordner anlegen, daher stammt es womöglich nicht von dieser Installation. Trotzdem herunterladen?\",\"backup_restore_unknown_confirm\":\"Dieses Archiv wurde hochgeladen, bevor Installationen benannt wurden, daher ist unbekannt, welche Installation es geschrieben hat. Trotzdem herunterladen?\",\"backup_restore_overwritten_confirm\":\"Diese Installation hat dieses Archiv hochgeladen, aber auf dem Laufwerk liegt nicht mehr, was sie hochgeladen hat – etwas anderes hat es inzwischen überschrieben. Trotzdem herunterladen?\",\"backup_restore_overwritten_refused\":\"Diese Installation hat dieses Archiv hochgeladen, aber auf dem Laufwerk liegt nicht mehr, was sie hochgeladen hat. Um es trotzdem herunterzuladen, öffne Gespeicherte Sicherungen und wähle Herunterladen.\",\"backup_restore_foreign_refused\":\"Dieses Archiv gehört einer anderen Installation. Bestätige die Wiederherstellung, um es trotzdem herunterzuladen.\",\"backup_restore_confirm_yes\":\"Herunterladen\",\"backup_restore_confirm_no\":\"Abbrechen\",\"access_title\":\"Freigabelinks\",\"access_empty\":\"Keine aktiven Freigabelinks.\",\"access_expires_in\":\"läuft ab {{when}}\",\"access_forget\":\"Aus Liste entfernen\",\"access_object_missing\":\"Datei gelöscht\",\"access_unchecked\":\"Diese Links wurden nicht mit dem Drive abgeglichen, daher wird eine gelöschte Datei hier nicht markiert.\",\"access_footer\":\"Das Entfernen aus der Liste widerruft den Link nicht — ein geteilter Link funktioniert bis zu seinem Ablauf.\",\"access_list_failed\":\"Die Freigabelinks konnten nicht gelesen werden.\",\"access_forget_failed\":\"Dieser Link konnte nicht aus der Liste entfernt werden. Er ist weiterhin aufgeführt.\",\"keys_count_one\":\"{{count}} Schlüssel\",\"keys_count_other\":\"{{count}} Schlüssel\",\"keys_for_account\":\"Schlüssel für {{name}}\",\"key_healthy\":\"Fehlerfrei\",\"parent_folders\":\"Übergeordnete Ordner\",\"folder_actions\":\"Ordneraktionen\",\"file_actions\":\"Dateiaktionen\",\"root_storage_used\":\"Was Speicher belegt\",\"root_section_objects_one\":\"{{objects}} Element\",\"root_section_objects_other\":\"{{objects}} Elemente\",\"view_grid\":\"Rasteransicht\",\"view_list\":\"Listenansicht\",\"library_add\":\"Aus Artefakten hinzufügen\",\"library_add_one\":\"Zur Artefakt-Bibliothek hinzufügen\",\"folder_open\":\"Ordner {{name}} öffnen\",\"library_adding\":\"Wird hinzugefügt…\",\"library_add_oneway\":\"Kopien hier belegen Cloud-Speicher.\",\"library_add_again\":\"Erneut hinzufügen\",\"library_add_count\":\"Aus Artefakten hinzufügen ({{count}} bereit)\",\"library_add_nothing\":\"Nichts mehr hinzuzufügen – alles Mögliche ist schon hier.\",\"library_list_failed\":\"Der Cloud-Inhalt konnte nicht gelesen werden.\",\"files_list_failed\":\"Dieser Ordner konnte nicht gelesen werden.\",\"library_local_failed\":\"Deine Artefakte konnten nicht gelesen werden.\",\"retry\":\"Erneut versuchen\",\"library_add_none\":\"Keine Artefakte gefunden.\",\"library_update\":\"Kopie aktualisieren\",\"library_search\":\"Ihre Artefakte durchsuchen\",\"library_push_failed\":\"Dieses Artefakt konnte nicht hinzugefügt werden. Bitte erneut versuchen.\",\"library_blurb\":\"Von Kiro für Sie erstellte Inhalte, in die Cloud kopiert. Selbst hochgeladene Dateien liegen in Dateien.\",\"library_empty_title\":\"Noch nichts in die Cloud kopiert\",\"library_empty_body\":\"Dieser Ordner enthält von Kiro für Sie erstellte Inhalte – Widgets, Seiten, Dokumente –, sobald Sie sie in die Cloud kopieren. Vom Computer hochgeladene Dateien gehören stattdessen in Dateien.\",\"library_cloud_only\":\"Nur in der Cloud\",\"library_in_cloud\":\"In der Cloud\",\"library_stale_preview\":\"Cloud-Kopie ist v{{version}}; die Vorschau zeigt die neuere lokale Kopie\",\"library_stale_list\":\"Cloud-Kopie ist v{{version}}; die lokale Kopie ist neuer\",\"library_added\":\"Hinzugefügt {{when}}\",\"library_open\":\"{{name}} in Artefakte öffnen\",\"files_empty_title\":\"Dateien ist leer\",\"files_empty_body\":\"Dieser Ordner enthält Dateien, die Sie vom Computer hochladen. Er ist getrennt von der Artefakt-Bibliothek, die von Kiro für Sie erstellte Inhalte enthält.\",\"library_remove\":\"Entfernen\",\"library_remove_confirm\":\"„{{name}}“ aus der Cloud-Bibliothek entfernen?\",\"library_remove_confirm_slug\":\"Dies leert den Cloud-Ordner <folder>{{folder}}</folder>.\",\"library_actions\":\"Aktionen für Bibliothekselement\",\"library_remove_action\":\"Kopie entfernen\",\"library_removing\":\"Wird entfernt…\",\"library_remove_failed\":\"Entfernen fehlgeschlagen — die Cloud-Kopie ist unverändert. Erneut versuchen.\",\"move_conflict\":\"Der Zielordner enthält bereits eine Datei mit diesem Namen. Wähle einen anderen Ordner oder benenne die Datei zuerst um.\",\"move_shared\":\"Diese Datei hat einen aktiven Freigabelink — beim Verschieben würde der Link ungültig. Entfernen Sie die Freigabe (oder lassen Sie sie ablaufen) und versuchen Sie es erneut.\",\"rename\":\"Umbenennen\",\"preview_truncated\":\"Große Datei — nur der Anfang wird angezeigt.\",\"preview_redacted\":\"Sensible Werte sind in dieser Vorschau maskiert.\",\"preview_unsupported\":\"Dieser Dateityp kann nicht als Vorschau angezeigt werden. Zum Ansehen herunterladen.\",\"preview_failed\":\"Vorschau konnte nicht geladen werden. Laden Sie die Datei zum Ansehen herunter oder versuchen Sie es erneut.\",\"search_files\":\"Nach Dateiname oder Pfad suchen…\",\"search_clear\":\"Suche löschen\",\"search_pending\":\"Suche läuft…\",\"search_capped\":\"Zu viele Treffer — nur die ersten {{count}} werden angezeigt.\",\"search_failed\":\"Suche fehlgeschlagen. Versuchen Sie es erneut.\",\"search_goto\":\"Enthaltenden Ordner öffnen\",\"move_failed\":\"Die Datei konnte nicht verschoben werden. Versuche es erneut.\",\"rename_conflict\":\"Eine Datei mit diesem Namen existiert hier bereits.\",\"rename_shared\":\"Diese Datei hat einen aktiven Freigabelink — eine Umbenennung würde den Link ungültig machen. Entfernen Sie die Freigabe (oder lassen Sie sie ablaufen) und versuchen Sie es erneut.\",\"rename_failed\":\"Die Datei konnte nicht umbenannt werden. Versuchen Sie es erneut.\",\"rename_failed_named\":\"„{{name}}“ konnte nicht umbenannt werden: {{reason}}\",\"library_add_empty\":\"Noch keine Artefakte. Was Kiro für Sie erstellt, erscheint hier und kann in die Cloud kopiert werden.\",\"move_to\":\"In Ordner verschieben…\",\"move_title\":\"„{{name}}“ verschieben nach\",\"move_root\":\"Dateien (oberste Ebene)\",\"move_up\":\"Nach oben zu {{name}}\",\"move_no_folders\":\"Hier gibt es keinen anderen Ordner, in den die Datei verschoben werden kann. Erstellen Sie zuerst einen.\",\"move_moving\":\"Wird verschoben…\",\"move_moving_picker\":\"Wird verschoben… Das Schließen bricht das Verschieben nicht ab.\",\"move_to_busy\":\"Eine andere Verschiebung läuft noch\",\"move_ask_agent\":\"Agent zu dieser Verschiebung fragen\",\"stat_storage\":\"Speicher\",\"stat_objects\":\"Objekte\",\"key_needs_attention\":\"Aufmerksamkeit nötig\",\"backup_state_current\":\"Gesichert\",\"backup_state_never\":\"Nie ausgeführt\",\"costs_refresh_failed\":\"Die letzte Abfrage der Rechnung ist fehlgeschlagen. Dies ist der zwischengespeicherte Wert.\"},\"page\":{\"refresh\":\"Aktualisieren\",\"health_ok\":\"Intakt\",\"health_degraded\":\"Erfordert Aufmerksamkeit\",\"health_unknown\":\"Unbekannt\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Credential-Prozess\",\"kind_other\":\"Andere\",\"default_profile\":\"Standardprofil\",\"not_connected_yet\":\"Noch nicht verbunden\",\"reconnect\":\"Neu verbinden\",\"reconnect_loading\":\"Hinweise zum Neuverbinden werden geladen…\",\"reconnect_error\":\"Hinweise zum Neuverbinden konnten nicht geladen werden.\",\"reconnect_hint_sso\":\"Melden Sie sich erneut an, um diese Verbindung zu erneuern, und aktualisieren Sie dann diese Seite.\",\"reconnect_hint_credential_process\":\"Führen Sie diesen Befehl in Ihrem Terminal aus, um die Anmeldedaten zu erneuern, und aktualisieren Sie dann diese Seite.\",\"reconnect_hint_other\":\"Führen Sie diesen Befehl in Ihrem Terminal aus, um die Verbindung wiederherzustellen, und aktualisieren Sie dann diese Seite.\",\"copy\":\"Kopieren\",\"copied\":\"Kopiert\",\"empty_title\":\"Noch keine Konten\",\"empty_body\":\"Registriere unter „Konten hinzufügen“ weiter unten ein AWS-Profil dieses Rechners, dann erscheint sein Konto hier.\",\"error_title\":\"Konten konnten nicht geladen werden.\",\"error_body\":\"Beim Lesen der Kontoliste ist etwas schiefgelaufen. Versuchen Sie es gleich noch einmal.\",\"error_forbidden_body\":\"Diese Dashboard-Sitzung gehört nicht dem Besitzer und kann daher keine AWS-Konten verwalten. Melden Sie sich als Besitzer an und versuchen Sie es erneut.\",\"retry\":\"Erneut versuchen\",\"disabled_title\":\"AWS Control ist deaktiviert\",\"disabled_body\":\"Aktivieren Sie die App im App Store, um Ihre Konten zu sehen.\",\"aggregate_accounts_one\":\"{{count}} Konto\",\"aggregate_accounts_other\":\"{{count}} Konten\",\"aggregate_keys_one\":\"{{count}} Schlüssel\",\"aggregate_keys_other\":\"{{count}} Schlüssel\",\"aggregate_healthy_one\":\"{{count}} fehlerfrei\",\"aggregate_healthy_other\":\"{{count}} fehlerfrei\",\"keys_summary_one\":\"{{count}} Schlüssel\",\"keys_summary_other\":\"{{count}} Schlüssel\",\"add_accounts_title\":\"Konten hinzufügen\",\"add_accounts_summary\":\"Weitere AWS-Profile dieses Rechners registrieren\",\"add_accounts_intro\":\"Diese lokalen AWS-Profile sind noch nicht registriert. Jedes, das du hinzufügst, wird zu einem Schlüssel unter seinem Konto.\",\"add_accounts_search_placeholder\":\"Profile suchen\",\"add_accounts_search_keeps_selected\":\"Profile, die du ausgewählt hast, bleiben in der Liste, auch wenn sie nicht passen.\",\"add_accounts_none\":\"Alle lokalen Profile sind bereits registriert.\",\"add_accounts_no_profiles\":\"Dieser Rechner hat noch keine AWS-Profile. Lege zuerst eines an (zum Beispiel mit aws configure in einem Terminal) und registriere es dann hier.\",\"add_accounts_unsupported\":\"AWS Control erreicht die AWS-Profile dieses Rechners unter Windows nicht: der AWS-Zugriff braucht eine Linux- oder macOS-Shell. Führe das {{productName}}-Gateway unter WSL (Windows Subsystem for Linux) aus und registriere dort die eingerichteten Profile.\",\"add_accounts_count_one\":\"{{count}} von {{max}} registriert\",\"add_accounts_count_other\":\"{{count}} von {{max}} registriert\",\"add_accounts_cap_reached\":\"Du hast das Limit von {{max}} Schlüsseln erreicht. Entferne einen, bevor du weitere hinzufügst.\",\"add_accounts_register\":\"Ausgewählte registrieren\",\"add_accounts_registering\":\"Wird registriert…\",\"add_accounts_error\":\"Diese Profile konnten nicht registriert werden. Es wurde nichts hinzugefügt. Versuche es erneut.\",\"add_accounts_load_error\":\"Die lokalen AWS-Profile konnten nicht aufgelistet werden.\",\"search_placeholder\":\"Konten suchen\",\"paid_services_title\":\"Kostenpflichtige Dienste\",\"orphan_consent\":\"Bestätigt für ein AWS-Konto, das hier nicht registriert ist. Ziehen Sie die Bestätigung unten zurück, oder registrieren Sie das Konto erneut, um es auf seiner eigenen Seite zu verwalten.\",\"account_actions\":\"Kontoaktionen\",\"remove_account\":\"Aus AWS Control entfernen…\",\"remove_account_action\":\"Entfernen\",\"remove_account_confirm\":\"„{{name}}“ aus AWS Control entfernen? In AWS und in Ihrer AWS-CLI-Konfiguration ändert sich nichts.\",\"remove_account_error\":\"Das Konto konnte nicht entfernt werden.\",\"remove_account_hint\":\"In AWS ändert sich nichts\",\"forget_key_confirm\":\"Den Schlüssel „{{name}}“ dieser Zeile vergessen? In AWS und in Ihrer AWS-CLI-Konfiguration ändert sich nichts.\",\"forget_key_action\":\"Schlüssel vergessen\",\"totals_summary_one\":\"{{accounts}} Konto · {{keys}}\",\"totals_summary_other\":\"{{accounts}} Konten · {{keys}}\",\"keys_healthy_one\":\"{{healthy}} von {{n}} Schlüssel fehlerfrei\",\"keys_healthy_other\":\"{{healthy}} von {{n}} Schlüsseln fehlerfrei\"},\"rail\":{\"accounts\":\"Konten & Anmeldedaten\",\"nav\":\"AWS Control-Bereiche\",\"switch_account\":\"Konto wechseln\",\"usage\":\"Nutzung & Kosten\",\"use_account\":\"Dieses Konto verwenden\"},\"overview\":{\"title\":\"Übersicht\",\"subtitle\":\"Ein Ort für die Konten, Schlüssel, das Cloud-Laufwerk und die kostenpflichtigen Dienste, die Ihre Agenten nutzen dürfen.\",\"stat_accounts\":\"Konten\",\"stat_accounts_attention_one\":\"{{count}} benötigt Aufmerksamkeit\",\"stat_accounts_attention_other\":\"{{count}} benötigen Aufmerksamkeit\",\"stat_accounts_all_ok\":\"Alle in Ordnung\",\"stat_keys\":\"Schlüssel in Ordnung\",\"stat_keys_sub_one\":\"{{count}} Schlüssel registriert\",\"stat_keys_sub_other\":\"{{count}} Schlüssel registriert\",\"stat_drive\":\"Laufwerk belegt\",\"stat_drive_none\":\"Noch kein Laufwerk\",\"stat_spend\":\"Aktueller Monat\",\"stat_spend_consent\":\"Kostenbericht ist aus\",\"stat_shares_none\":\"Nichts geteilt\",\"stat_shares_sub_one\":\"{{count}} aktiver Link\",\"stat_shares_sub_other\":\"{{count}} aktive Links\",\"stat_backups_nightly\":\"Nächtlich\",\"stat_backups_manual\":\"Manuell\",\"stat_backups_sub_nightly\":\"Läuft jede Nacht\",\"stat_backups_sub_manual\":\"Kein Zeitplan festgelegt\",\"accounts_title\":\"Konten\",\"accounts_note\":\"Agenten nutzen diese Schlüssel, ohne sie je zu sehen. Nichts aus einem Schlüssel erscheint in einem Chat.\",\"add_account\":\"Konto hinzufügen\",\"drive_title\":\"Cloud-Laufwerk\",\"drive_bar_label\":\"{{size}} gespeichert, verteilt auf Dateien, Artefaktbibliothek und Sicherungen\",\"drive_empty_title\":\"Noch kein Cloud-Laufwerk\",\"drive_empty_body\":\"Erstellen Sie in diesem Konto einen privaten, verschlüsselten Bucket für Ihre Dateien, die Artefaktbibliothek und Sicherungen.\",\"drive_setup\":\"Cloud-Laufwerk einrichten\",\"drive_bucket_label\":\"Bucket\",\"stat_spend_scope\":\"AWS-Rechnung dieses Kontos\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "AWS-Nutzung vor der ersten Anfrage bestaetigen",
				"confirmed_title": "AWS-Nutzung bestaetigt",
				"account_changed": "Die Bestaetigung galt fuer ein anderes AWS-Konto und wurde daher zurueckgezogen. Pruefen Sie das Konto unten und bestaetigen Sie erneut.",
				"service": "Dienst",
				"region": "Region",
				"credential_source": "Quelle der Anmeldedaten",
				"aws_account": "AWS-Konto",
				"provider_default": "(Standard des Anbieters)",
				"unresolved_account": "konnte nicht ermittelt werden",
				"billing_notice": "Dies ist ein kostenpflichtiger AWS-Dienst. Bis zur Bestaetigung wird keine Anfrage gesendet.",
				"confirm_button": "Bestaetigen und aktivieren",
				"withdraw": "Bestaetigung zuruecknehmen",
				"status_failed": "Der Bestätigungsstatus konnte nicht gelesen werden.",
				"confirm_failed": "Die Bestätigung wurde nicht gespeichert.",
				"withdraw_failed": "Die Bestätigung wurde nicht zurückgenommen.",
				"retry": "Erneut versuchen",
				"badge_confirmed": "Bestätigt",
				"badge_not_enabled": "Nicht aktiviert",
				"confirmed_on": "bestätigt am {{date}}",
				"billing_notice_short": "Kostenpflichtig. Es wird nichts gesendet, bis Sie bestätigen.",
				"pending_profile_hint": "Schließ die Eingabe des AWS-Profils ab, um zu bestätigen.",
				"bedrock_kb_billing_short": "Pro Suche abgerechnet: ein Bedrock-Retrieve-Aufruf pro Knowledge Base",
				"aws_pricing_link": "AWS-Preise",
				"withdraw_effect": "Nach dem Zurückziehen nutzen Agenten diesen Dienst nicht mehr, bis du erneut bestätigst."
			},
			"ui": {
				"clear_filter": "Filter löschen",
				"no_matches_for": "Keine Treffer für",
				"no_noun_match": "Keine passenden {{noun}}"
			}
		}
	},
	en: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"Your cloud accounts, in plain language. See every AWS account Kiro Crew can use with a health light per account and matched reconnect guidance, plus an S3-backed cloud drive — files, a cloud artifact library, and backups — with time-boxed share links. Nothing is public unless you say so, and every paid service asks for your confirmation before it can bill you.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"One health light per account, each with reconnect guidance matched to how the profile authenticates\",\"highlight_2\":\"Private, encrypted, versioned storage that is created only after you confirm it\",\"highlight_3\":\"Your cloud artifact library, files, and backups all live on one bucket you own\",\"highlight_4\":\"Share links always expire — nothing is public unless you say so\",\"highlight_5\":\"Every paid service is confirmed per account before its first use, and every change is on the record\",\"page_label\":\"AWS Control\",\"use_case_1\":\"See every AWS account Kiro Crew can reach, which ones are healthy, and what this month is costing you -- without opening the AWS console.\",\"configuration_1\":\"Add an account from the profiles already on this machine, then confirm each paid service once per account before it is first used.\"},\"console\":{\"copy\":\"Copy\",\"copied\":\"Copied\",\"close\":\"Close\",\"loading\":\"Loading…\",\"download\":\"Download\",\"share\":\"Share\",\"delete\":\"Delete\",\"delete_failed\":\"Delete failed — the file is unchanged. Try again.\",\"delete_failed_named\":\"Could not delete “{{name}}” — the file is unchanged. Try again.\",\"download_failed\":\"Couldn't start the download. Nothing was sent. Try again.\",\"delete_confirm_action\":\"Delete file\",\"delete_confirm\":\"Delete “{{name}}”? The file is removed from the drive.\",\"col_name\":\"Name\",\"col_kind\":\"Kind\",\"col_size\":\"Size\",\"col_modified\":\"Modified\",\"col_actions\":\"Actions\",\"kind_folder\":\"Folder\",\"folder_new\":\"New folder\",\"folder_name\":\"Folder name\",\"folder_delete_confirm\":\"Delete “{{name}}” and everything in it?\",\"folder_delete_action\":\"Delete folder\",\"folder_delete_failed\":\"Could not delete the folder.\",\"folder_create_failed\":\"Could not create the folder.\",\"folder_bad_name\":\"That folder name has characters the drive can't store. Letters, digits, spaces and . _ - ( ) + @ = are safe.\",\"folder_deleted_one\":\"Deleted “{{name}}”: {{count}} item.\",\"folder_deleted_other\":\"Deleted “{{name}}”: {{count}} items.\",\"cancel\":\"Cancel\",\"load_more\":\"Load more\",\"stat_this_month\":\"This month\",\"storage_consent_needed\":\"Cloud storage has not been confirmed for this account yet. Confirm it below, then refresh.\",\"stat_stored_value\":\"{{size}} · {{objects}} items\",\"costs_as_of\":\"Cached figures, as of {{date}}.\",\"costs_consent_missing\":\"Turn on cost reporting below to see this account's spending.\",\"costs_unavailable\":\"The bill could not be read right now.\",\"account_unavailable\":\"This account can't be reached right now. Reconnect it, then come back.\",\"drive_status_failed\":\"Couldn't read the drive right now.\",\"setup_title\":\"Set up a cloud drive\",\"setup_body\":\"This creates one private, encrypted, versioned storage bucket in your own account, for your files, artifact library, and backups.\",\"setup_costs_note\":\"Costs follow use: you pay AWS for what you store, and nothing before that.\",\"setup_preview_region\":\"Region\",\"setup_preview_resource\":\"Resource\",\"setup_preview_btn\":\"Preview\",\"setup_confirm_btn\":\"Create it\",\"setup_creating\":\"Creating…\",\"setup_error\":\"Couldn't prepare the drive. Try again in a moment.\",\"setup_confirm_error\":\"Couldn't create the drive. Nothing was changed — check the permissions below and try again.\",\"setup_policy_error\":\"Couldn't load the permissions to paste.\",\"setup_policy_label\":\"Show the exact permissions to paste\",\"library_all\":\"All\",\"library_not_pushable\":\"Images can't be added to the cloud yet.\",\"kind_widget\":\"Widget\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Text\",\"kind_webapp\":\"Web app\",\"kind_image\":\"Image\",\"drive_title\":\"Drive\",\"drive_upload\":\"Upload\",\"drive_uploading\":\"Uploading…\",\"drive_bad_name\":\"That file name has characters the drive can't store. Letters, digits, spaces and . _ - ( ) + @ = are safe.\",\"rename_bad_name\":\"That name has characters the drive can't store. Change the name and try again.\",\"drive_bad_name_named\":\"“{{name}}” can’t be uploaded — the name has characters the drive can’t store. Letters, digits, spaces and . _ - ( ) + @ = are safe.\",\"drive_upload_failed\":\"“{{name}}” could not be uploaded. Try again.\",\"section_files\":\"Files\",\"section_library\":\"Artifact library\",\"section_backup\":\"Backup\",\"share_title\":\"Share “{{name}}”\",\"share_expiry\":\"Link expires after\",\"share_note\":\"Note\",\"share_note_placeholder\":\"What is this link for?\",\"share_create\":\"Create link\",\"share_creating\":\"Creating…\",\"share_failed\":\"Couldn't create the share link. Nothing was shared.\",\"expiry_1h\":\"1 hour\",\"expiry_1d\":\"1 day\",\"expiry_7d\":\"7 days\",\"share_expires_note\":\"The link stops working when it expires, and it can't be recalled earlier.\",\"share_credentials_caveat\":\"It may stop working sooner if the account's sign-in session ends first.\",\"cli_drawer_label\":\"Where this lives\",\"cli_drawer_hint\":\"These files live under {{prefix}} in the bucket {{bucket}}. This command lists them from a terminal that has your credentials.\",\"backup_title\":\"Backup\",\"backup_kind_snapshot\":\"Memory & workspace\",\"backup_kind_sessions\":\"Sessions archive\",\"backup_last_run\":\"Last backed up {{when}} · {{size}}\",\"backup_never\":\"Not backed up yet\",\"backup_never_recorded\":\"No run recorded here — earlier archives may still be on the drive\",\"backup_remembered\":\"Archives this install has recorded: {{count}} · show the list\",\"backup_sessions_scope\":\"Includes the CLI replay logs for every session under this Kiro home, not only chats started in {{productName}}.\",\"backup_run_now\":\"Back up now\",\"backup_running\":\"Backing up…\",\"backup_failed\":\"Last run failed: {{reason}}\",\"backup_start_failed\":\"Could not start the backup.\",\"backup_start_retry\":\"Could not start the backup. Try again.\",\"backup_start_unavailable\":\"Backups are not available for this app. Check that the job runtime is registered.\",\"backup_start_consent\":\"Grant S3 access for this account, then start the backup.\",\"backup_start_no_drive\":\"This account has no drive yet. Create one, then start the backup.\",\"backup_nightly\":\"Back up every night\",\"backup_nightly_hint\":\"Runs a memory & workspace snapshot once a day.\",\"backup_nightly_blocked_other_account\":\"Nightly snapshots only run for the default account, so nothing is backed up for this account.\",\"backup_nightly_sessions\":\"Back up sessions every night\",\"backup_nightly_sessions_hint\":\"Uploads the sessions archive to this account's drive once a day. It carries your conversations as they are, with nothing removed.\",\"backup_nightly_sessions_destination\":\"That drive is S3 storage in this AWS account, and {{button}} sends the archive to the same place.\",\"backup_nightly_sessions_blocked_host\":\"This computer cannot make the sessions archive, so nothing is uploaded.\",\"backup_nightly_sessions_blocked_redaction\":\"Outbound redaction is on and the sessions archive cannot be redacted yet, so nothing is uploaded.\",\"backup_nightly_sessions_blocked_other_account\":\"Nightly uploads only run for the default account, so nothing is uploaded for this one.\",\"backup_nightly_sessions_blocked_other\":\"Nightly uploads are on hold on this computer, so nothing is uploaded.\",\"backup_nightly_sessions_blocked_next\":\"You can still start the backup yourself.\",\"backup_nightly_sessions_blocked_next_redaction\":\"You can still start the backup yourself, but it uploads the sessions archive without redaction.\",\"backup_archive\":\"Stored backups\",\"backup_restore\":\"Restore\",\"backup_show_all_archives\":\"Show all ({{count}})\",\"backup_restore_caveat\":\"Restore needs read access to the backup folder. The recommended least-privilege policy deliberately grants write only, so it will be denied unless the account's credentials are broader.\",\"backup_remote_error\":\"Couldn't read the stored backups just now.\",\"backup_status_failed\":\"Couldn't read the backup status.\",\"backup_nightly_failed\":\"Couldn’t change “{{setting}}”. It is unchanged.\",\"backup_restore_failed\":\"Couldn't restore that backup. Nothing was written.\",\"backup_restored_note\":\"Your current data was not replaced. The backup was downloaded to a staging folder at the path below.\",\"backup_restore_recovered_note\":\"This install's own upload was downloaded and checked against what it recorded. Something else had written over it on the drive, and can do the same to your next upload. Start with the other installs this page lists as backing up to this drive.\",\"backup_install\":\"This install\",\"backup_install_hint\":\"Each install stores its backups under its own name, so a restore can tell this install's archives from another install's.\",\"backup_install_rename\":\"Rename\",\"backup_install_save\":\"Save name\",\"backup_install_rename_failed\":\"Couldn't save the install name. It is unchanged.\",\"backup_install_name_label\":\"Install name\",\"backup_attribution_self\":\"{{label}} · this install\",\"backup_attribution_self_unnamed\":\"this install\",\"backup_attribution_other\":\"\\\"{{label}}\\\" (another install · {{id}})\",\"backup_attribution_other_unnamed\":\"another install · {{id}}\",\"backup_attribution_unverified\":\"unverified origin\",\"backup_origin_unknown\":\"unknown origin\",\"backup_none_from_this_install\":\"No backups from this install. Include the other installs' archives to see theirs.\",\"backup_others_on_drive\":\"Other installs backing up to this drive: {{count}}\",\"backup_show_others\":\"Include archives from other installs\",\"backup_others_truncated\":\"Only the first {{max}} other installs are shown.\",\"backup_archives_truncated\":\"Some {{kind}} archives could not be listed. The newest may be missing.\",\"backup_shared_note\":\"One drive shared by two installs is not shared memory and not shared sessions. Each backup is a separate archive of one point in time, and a restore only downloads that file to a staging folder — you replace files yourself, with the gateway stopped.\",\"backup_restore_foreign_confirm\":\"This archive was uploaded by another install ({{install}}). Restoring it downloads that install's data, not this install's. Download it anyway?\",\"backup_restore_unverified_confirm\":\"This archive is stored under this install's own folder, but this install has no record of uploading it. Anything that can write to the drive can create that folder, so it may not be this install's. Download it anyway?\",\"backup_restore_unknown_confirm\":\"This archive was uploaded before installs were named, so which install wrote it is unknown. Download it anyway?\",\"backup_restore_overwritten_confirm\":\"This install uploaded this archive, but the drive no longer holds what it uploaded — something else has written over it since. Download it anyway?\",\"backup_restore_overwritten_refused\":\"This install uploaded this archive, but the drive no longer holds what it uploaded. To download it anyway, open Stored backups and choose Download it.\",\"backup_restore_foreign_refused\":\"That archive belongs to another install. Confirm the restore to download it anyway.\",\"backup_restore_confirm_yes\":\"Download it\",\"backup_restore_confirm_no\":\"Cancel\",\"access_title\":\"Share links\",\"access_empty\":\"No active share links.\",\"access_expires_in\":\"expires {{when}}\",\"access_forget\":\"Remove from list\",\"access_object_missing\":\"File deleted\",\"access_unchecked\":\"These links were not checked against the drive, so a deleted file is not flagged here.\",\"access_footer\":\"Removing a link from this list does not revoke it — a shared link keeps working until it expires.\",\"access_list_failed\":\"Couldn't read the share links.\",\"access_forget_failed\":\"Couldn't remove that link from the list. It is still listed.\",\"keys_count_one\":\"{{count}} key\",\"keys_count_other\":\"{{count}} keys\",\"keys_for_account\":\"Keys for {{name}}\",\"key_healthy\":\"Healthy\",\"parent_folders\":\"Parent folders\",\"folder_actions\":\"Folder actions\",\"file_actions\":\"File actions\",\"root_storage_used\":\"What's using storage\",\"root_section_objects_one\":\"{{objects}} item\",\"root_section_objects_other\":\"{{objects}} items\",\"view_grid\":\"Grid view\",\"view_list\":\"List view\",\"library_add\":\"Add from Artifacts\",\"library_add_one\":\"Add to Artifact library\",\"folder_open\":\"Open folder {{name}}\",\"library_adding\":\"Adding…\",\"library_add_oneway\":\"Copies here fill cloud storage.\",\"library_add_again\":\"Add again\",\"library_add_count\":\"Add from Artifacts ({{count}} ready)\",\"library_add_nothing\":\"Nothing left to add — everything that can be is already here.\",\"library_list_failed\":\"Could not read what is in the cloud.\",\"files_list_failed\":\"Couldn't read this folder.\",\"library_local_failed\":\"Could not read your artifacts.\",\"retry\":\"Try again\",\"library_add_none\":\"No artifacts match.\",\"library_update\":\"Update copy\",\"library_search\":\"Search your artifacts\",\"library_push_failed\":\"Could not add this artifact. Try again.\",\"library_blurb\":\"Things Kiro made for you, copied to the cloud. Files you upload yourself live in Files.\",\"library_empty_title\":\"Nothing copied to the cloud yet\",\"library_empty_body\":\"This folder holds things Kiro made for you — widgets, pages, documents — once you copy them to the cloud. Files you upload from your computer belong in Files instead.\",\"library_cloud_only\":\"In the cloud only\",\"library_in_cloud\":\"In the cloud\",\"library_stale_preview\":\"Cloud copy is v{{version}}; preview shows your newer local copy\",\"library_stale_list\":\"Cloud copy is v{{version}}; your local copy is newer\",\"library_added\":\"Added {{when}}\",\"library_open\":\"Open {{name}} in Artifacts\",\"files_empty_title\":\"Files is empty\",\"files_empty_body\":\"This folder holds files you upload from your computer. It is separate from Artifact library, which holds things Kiro made for you.\",\"library_remove\":\"Remove\",\"library_remove_confirm\":\"Remove “{{name}}” from the cloud library?\",\"library_actions\":\"Library item actions\",\"library_remove_action\":\"Remove copy\",\"library_removing\":\"Removing…\",\"library_remove_failed\":\"Remove failed — the cloud copy is unchanged. Try again.\",\"move_conflict\":\"The destination folder already has a file with this name. Pick another folder, or rename the file first.\",\"move_shared\":\"This file has a live share link — moving it would break the link. Remove the share (or let it expire) and try again.\",\"rename\":\"Rename\",\"preview_truncated\":\"Large file — showing only the beginning.\",\"preview_redacted\":\"Sensitive values are masked in this preview.\",\"preview_unsupported\":\"This file type can’t be previewed. Download it to view.\",\"preview_failed\":\"Preview failed to load. Download the file to view it, or try again.\",\"search_files\":\"Search by file name or path…\",\"search_clear\":\"Clear search\",\"search_pending\":\"Searching…\",\"search_capped\":\"Too many matches — showing the first {{count}}.\",\"search_failed\":\"Search failed. Try again.\",\"search_goto\":\"Open containing folder\",\"move_failed\":\"Could not move the file. Try again.\",\"rename_conflict\":\"A file with this name already exists here.\",\"rename_shared\":\"This file has a live share link — renaming it would break the link. Remove the share (or let it expire) and try again.\",\"rename_failed\":\"Could not rename the file. Try again.\",\"rename_failed_named\":\"Could not rename “{{name}}”: {{reason}}\",\"library_add_empty\":\"No artifacts yet. Things Kiro makes for you will show up here, ready to copy to the cloud.\",\"move_to\":\"Move to folder…\",\"move_title\":\"Move “{{name}}” to\",\"move_root\":\"Files (top level)\",\"move_up\":\"Up to {{name}}\",\"move_no_folders\":\"There is no other folder here to move it into. Create one first.\",\"move_moving\":\"Moving…\",\"move_moving_picker\":\"Moving… Closing this does not cancel the move.\",\"move_to_busy\":\"Another move is still running\",\"move_ask_agent\":\"Ask the agent about this move\",\"stat_storage\":\"Storage\",\"stat_objects\":\"Objects\",\"key_needs_attention\":\"Needs attention\",\"backup_state_current\":\"Backed up\",\"backup_state_never\":\"Never run\",\"costs_refresh_failed\":\"The latest bill read failed; this is the cached figure.\",\"library_remove_confirm_slug\":\"This empties the cloud folder <folder>{{folder}}</folder>.\",\"setup_searched_region\":\"No drive found in {{region}}. Only this region was searched, so a drive in another region of this account will not show here.\"},\"page\":{\"refresh\":\"Refresh\",\"health_ok\":\"Healthy\",\"health_degraded\":\"Needs attention\",\"health_unknown\":\"Unknown\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Credential process\",\"kind_other\":\"Other\",\"default_profile\":\"Default profile\",\"not_connected_yet\":\"Not connected yet\",\"reconnect\":\"Reconnect\",\"reconnect_loading\":\"Loading reconnect guidance…\",\"reconnect_error\":\"Could not load reconnect guidance.\",\"reconnect_hint_sso\":\"Sign in again to refresh this connection, then Refresh this page.\",\"reconnect_hint_credential_process\":\"Run this command in your terminal to renew the credentials, then Refresh this page.\",\"reconnect_hint_other\":\"Run this command in your terminal to restore the connection, then Refresh this page.\",\"copy\":\"Copy\",\"copied\":\"Copied\",\"empty_title\":\"No accounts yet\",\"empty_body\":\"Register one of this machine's AWS profiles under Add accounts below, and its account appears here.\",\"error_title\":\"Couldn't load your accounts.\",\"error_body\":\"Something went wrong reading the account list. Try again in a moment.\",\"error_forbidden_body\":\"This dashboard session is not the owner's, so it cannot manage AWS accounts. Sign in as the owner, then try again.\",\"retry\":\"Try again\",\"disabled_title\":\"AWS Control is turned off\",\"disabled_body\":\"Enable the app from the App Store to see your accounts.\",\"aggregate_accounts_one\":\"{{count}} account\",\"aggregate_accounts_other\":\"{{count}} accounts\",\"aggregate_keys_one\":\"{{count}} key\",\"aggregate_keys_other\":\"{{count}} keys\",\"aggregate_healthy_one\":\"{{count}} healthy\",\"aggregate_healthy_other\":\"{{count}} healthy\",\"keys_summary_one\":\"{{count}} key\",\"keys_summary_other\":\"{{count}} keys\",\"add_accounts_title\":\"Add accounts\",\"add_accounts_summary\":\"Register more of this machine's AWS profiles\",\"add_accounts_intro\":\"These local AWS profiles aren't registered yet. Each one you add becomes a key under its account.\",\"add_accounts_search_placeholder\":\"Search profiles\",\"add_accounts_search_keeps_selected\":\"Profiles you've selected stay listed even when they don't match.\",\"add_accounts_none\":\"Every local profile is already registered.\",\"add_accounts_no_profiles\":\"This machine has no AWS profiles yet. Create one first (for example, run aws configure in a terminal), then register it here.\",\"add_accounts_unsupported\":\"AWS Control can't reach this machine's AWS profiles on Windows: its AWS access needs a Linux or macOS shell. Run the {{productName}} gateway under WSL (Windows Subsystem for Linux), then register the profiles you set up there.\",\"add_accounts_count_one\":\"{{count}} of {{max}} registered\",\"add_accounts_count_other\":\"{{count}} of {{max}} registered\",\"add_accounts_cap_reached\":\"You've reached the {{max}}-key limit. Remove one before adding more.\",\"add_accounts_register\":\"Register selected\",\"add_accounts_registering\":\"Registering…\",\"add_accounts_error\":\"Couldn't register those profiles. Nothing was added. Try again.\",\"add_accounts_load_error\":\"Couldn't list the local AWS profiles.\",\"search_placeholder\":\"Search accounts\",\"paid_services_title\":\"Paid services\",\"orphan_consent\":\"Confirmed for an AWS account that is not registered here. Withdraw it below, or register that account again to manage it from its own page.\",\"account_actions\":\"Account actions\",\"remove_account\":\"Remove from AWS Control…\",\"remove_account_action\":\"Remove\",\"remove_account_confirm\":\"Remove “{{name}}” from AWS Control? Nothing in AWS or in your AWS CLI configuration changes.\",\"remove_account_error\":\"The account could not be removed.\",\"remove_account_hint\":\"Nothing in AWS changes\",\"forget_key_confirm\":\"Forget this row’s key “{{name}}”? Nothing in AWS or in your AWS CLI configuration changes.\",\"forget_key_action\":\"Forget key\",\"totals_summary_one\":\"{{accounts}} account · {{keys}}\",\"totals_summary_other\":\"{{accounts}} accounts · {{keys}}\",\"keys_healthy_one\":\"{{healthy}} of {{n}} key healthy\",\"keys_healthy_other\":\"{{healthy}} of {{n}} keys healthy\"},\"rail\":{\"accounts\":\"Accounts & credentials\",\"nav\":\"AWS Control sections\",\"switch_account\":\"Switch account\",\"usage\":\"Usage & costs\",\"use_account\":\"Use this account\"},\"overview\":{\"title\":\"Overview\",\"subtitle\":\"One room for the accounts, keys, cloud drive and paid services your agents are allowed to touch.\",\"stat_accounts\":\"Accounts\",\"stat_accounts_attention_one\":\"{{count}} needs attention\",\"stat_accounts_attention_other\":\"{{count}} need attention\",\"stat_accounts_all_ok\":\"All healthy\",\"stat_keys\":\"Keys healthy\",\"stat_keys_sub_one\":\"{{count}} key registered\",\"stat_keys_sub_other\":\"{{count}} keys registered\",\"stat_drive\":\"Drive used\",\"stat_drive_none\":\"No drive yet\",\"stat_spend\":\"Month to date\",\"stat_spend_consent\":\"Cost reporting is off\",\"stat_shares_none\":\"Nothing shared\",\"stat_shares_sub_one\":\"{{count}} live link\",\"stat_shares_sub_other\":\"{{count}} live links\",\"stat_backups_nightly\":\"Nightly\",\"stat_backups_manual\":\"Manual\",\"stat_backups_sub_nightly\":\"Runs every night\",\"stat_backups_sub_manual\":\"No schedule set\",\"accounts_title\":\"Accounts\",\"accounts_note\":\"Agents use these keys without ever seeing them; nothing from a key appears in a chat.\",\"add_account\":\"Add account\",\"drive_title\":\"Cloud drive\",\"drive_bar_label\":\"{{size}} stored, split across files, the artifact library and backups\",\"drive_empty_title\":\"No cloud drive yet\",\"drive_empty_body\":\"Create one private, encrypted bucket in this account for your files, artifact library and backups.\",\"drive_setup\":\"Set up cloud drive\",\"drive_bucket_label\":\"Bucket\",\"stat_spend_scope\":\"This account's AWS bill\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "Confirm AWS usage before the first request",
				"confirmed_title": "AWS usage confirmed",
				"account_changed": "This was confirmed for a different AWS account, so the confirmation was withdrawn. Review the account below and confirm again.",
				"service": "Service",
				"region": "Region",
				"credential_source": "Credential source",
				"aws_account": "AWS account",
				"provider_default": "(provider default)",
				"unresolved_account": "could not be resolved",
				"billing_notice": "This is a paid AWS service. Until you confirm, no request is sent.",
				"confirm_button": "Confirm and enable",
				"withdraw": "Withdraw confirmation",
				"status_failed": "Couldn't read the confirmation status.",
				"confirm_failed": "The confirmation wasn't recorded.",
				"withdraw_failed": "The confirmation wasn't withdrawn.",
				"retry": "Try again",
				"badge_confirmed": "Confirmed",
				"badge_not_enabled": "Not enabled",
				"confirmed_on": "confirmed {{date}}",
				"billing_notice_short": "Billable. Nothing is sent until you confirm.",
				"pending_profile_hint": "Finish editing the profile to confirm.",
				"bedrock_kb_billing_short": "Billed per search: one Bedrock Retrieve call per Knowledge Base",
				"aws_pricing_link": "AWS pricing",
				"withdraw_effect": "Withdrawing stops agents using this service until you confirm again."
			},
			"ui": {
				"clear_filter": "Clear filter",
				"no_matches_for": "No matches for",
				"no_noun_match": "No {{noun}} match"
			}
		}
	},
	es: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"Tus cuentas en la nube, en lenguaje claro. Consulta cada cuenta de AWS que Kiro Crew puede usar con un indicador de estado por cuenta y orientación de reconexión adaptada, además de una unidad en la nube respaldada por S3 —archivos, una biblioteca de artefactos en la nube y copias de seguridad— con enlaces para compartir con caducidad. Nada es público salvo que tú lo indiques, y cada servicio de pago solicita tu confirmación antes de poder generarte cargos.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"Un indicador de estado por cuenta, cada uno con orientación de reconexión adaptada a cómo se autentica el perfil\",\"highlight_2\":\"Almacenamiento privado, cifrado y con versiones que solo se crea después de que lo confirmes\",\"highlight_3\":\"Tu biblioteca de artefactos en la nube, tus archivos y tus copias de seguridad viven en un solo bucket que te pertenece\",\"highlight_4\":\"Los enlaces para compartir siempre caducan: nada es público salvo que tú lo indiques\",\"highlight_5\":\"Cada servicio de pago se confirma por cuenta antes de su primer uso, y todo cambio queda registrado\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Consulta cada cuenta de AWS que Kiro Crew puede alcanzar, cuáles están saludables y cuánto te está costando este mes, sin abrir la consola de AWS.\",\"configuration_1\":\"Añade una cuenta desde los perfiles que ya están en esta máquina y luego confirma cada servicio de pago una vez por cuenta antes de usarlo.\"},\"console\":{\"copy\":\"Copiar\",\"copied\":\"Copiado\",\"close\":\"Cerrar\",\"loading\":\"Cargando…\",\"download\":\"Descargar\",\"share\":\"Compartir\",\"delete\":\"Eliminar\",\"delete_failed\":\"No se pudo eliminar: el archivo no ha cambiado. Inténtalo de nuevo.\",\"delete_failed_named\":\"No se pudo eliminar «{{name}}»: el archivo no ha cambiado. Inténtalo de nuevo.\",\"download_failed\":\"No se pudo iniciar la descarga. No se envió nada. Vuelve a intentarlo.\",\"delete_confirm_action\":\"Eliminar archivo\",\"delete_confirm\":\"¿Eliminar “{{name}}”? El archivo se quita de la unidad.\",\"col_name\":\"Nombre\",\"col_kind\":\"Tipo\",\"col_size\":\"Tamaño\",\"col_modified\":\"Modificado\",\"col_actions\":\"Acciones\",\"kind_folder\":\"Carpeta\",\"folder_new\":\"Nueva carpeta\",\"folder_name\":\"Nombre de la carpeta\",\"folder_delete_confirm\":\"¿Eliminar “{{name}}” y todo lo que contiene?\",\"folder_delete_action\":\"Eliminar carpeta\",\"folder_delete_failed\":\"No se pudo eliminar la carpeta.\",\"folder_create_failed\":\"No se pudo crear la carpeta.\",\"folder_bad_name\":\"Ese nombre de carpeta tiene caracteres que la unidad no puede almacenar. Letras, dígitos, espacios y . _ - ( ) + @ = son seguros.\",\"folder_deleted_one\":\"Se eliminó «{{name}}»: {{count}} elemento.\",\"folder_deleted_other\":\"Se eliminó «{{name}}»: {{count}} elementos.\",\"folder_deleted_many\":\"Se eliminó «{{name}}»: {{count}} elementos.\",\"cancel\":\"Cancelar\",\"load_more\":\"Cargar más\",\"stat_this_month\":\"Este mes\",\"storage_consent_needed\":\"El almacenamiento en la nube de esta cuenta aún no está confirmado. Confírmalo abajo y luego actualiza la página.\",\"stat_stored_value\":\"{{size}} · {{objects}} elementos\",\"costs_as_of\":\"Cifras en caché, con fecha {{date}}.\",\"costs_consent_missing\":\"Activa los informes de costes abajo para ver el gasto de esta cuenta.\",\"costs_unavailable\":\"No se pudo leer la factura en este momento.\",\"account_unavailable\":\"No se puede acceder a esta cuenta ahora mismo. Vuelve a conectarla y regresa.\",\"drive_status_failed\":\"No se pudo leer la unidad ahora mismo.\",\"setup_title\":\"Configura una unidad en la nube\",\"setup_body\":\"Esto crea un único bucket de almacenamiento privado, cifrado y con versiones en tu propia cuenta, para tus archivos, tu biblioteca de artefactos y tus copias de seguridad.\",\"setup_searched_region\":\"No se encontró ninguna unidad en {{region}}. Solo se buscó en esta región, así que una unidad en otra región de esta cuenta no aparecerá aquí.\",\"setup_costs_note\":\"Los costes dependen del uso: pagas a AWS por lo que almacenas, y nada antes de eso.\",\"setup_preview_region\":\"Región\",\"setup_preview_resource\":\"Recurso\",\"setup_preview_btn\":\"Vista previa\",\"setup_confirm_btn\":\"Crearla\",\"setup_creating\":\"Creando…\",\"setup_error\":\"No se pudo preparar la unidad. Inténtalo de nuevo en un momento.\",\"setup_confirm_error\":\"No se pudo crear la unidad. No se cambió nada: revisa los permisos de abajo e inténtalo de nuevo.\",\"setup_policy_error\":\"No se pudieron cargar los permisos para pegar.\",\"setup_policy_label\":\"Mostrar los permisos exactos para pegar\",\"library_all\":\"Todos\",\"library_not_pushable\":\"Las imágenes aún no se pueden copiar a la nube.\",\"kind_widget\":\"Widget\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Texto\",\"kind_webapp\":\"Aplicación web\",\"kind_image\":\"Imagen\",\"drive_title\":\"Unidad\",\"drive_upload\":\"Subir\",\"drive_uploading\":\"Subiendo…\",\"drive_bad_name\":\"Ese nombre de archivo tiene caracteres que la unidad no puede almacenar. Letras, dígitos, espacios y . _ - ( ) + @ = son seguros.\",\"rename_bad_name\":\"Ese nombre tiene caracteres que la unidad no puede almacenar. Cambia el nombre e inténtalo de nuevo.\",\"drive_bad_name_named\":\"No se puede subir «{{name}}»: el nombre tiene caracteres que la unidad no puede almacenar. Letras, dígitos, espacios y . _ - ( ) + @ = son seguros.\",\"drive_upload_failed\":\"No se pudo subir «{{name}}». Inténtalo de nuevo.\",\"section_files\":\"Archivos\",\"section_library\":\"Biblioteca de artefactos\",\"section_backup\":\"Copia de seguridad\",\"share_title\":\"Compartir «{{name}}»\",\"share_expiry\":\"El enlace caduca tras\",\"share_note\":\"Nota\",\"share_note_placeholder\":\"¿Para qué es este enlace?\",\"share_create\":\"Crear enlace\",\"share_creating\":\"Creando…\",\"share_failed\":\"No se pudo crear el enlace para compartir. No se compartió nada.\",\"expiry_1h\":\"1 hora\",\"expiry_1d\":\"1 día\",\"expiry_7d\":\"7 días\",\"share_expires_note\":\"El enlace deja de funcionar cuando caduca, y no se puede revocar antes.\",\"share_credentials_caveat\":\"Puede dejar de funcionar antes si la sesión de inicio de la cuenta termina primero.\",\"cli_drawer_label\":\"Dónde está esto\",\"cli_drawer_hint\":\"Estos archivos están bajo {{prefix}} en el bucket {{bucket}}. Este comando los lista desde una terminal que tenga tus credenciales.\",\"backup_title\":\"Copia de seguridad\",\"backup_kind_snapshot\":\"Memoria y espacio de trabajo\",\"backup_kind_sessions\":\"Archivo de sesiones\",\"backup_last_run\":\"Última copia {{when}} · {{size}}\",\"backup_never\":\"Aún sin copia de seguridad\",\"backup_never_recorded\":\"No hay ninguna ejecución registrada aquí: puede que archivos anteriores sigan en la unidad\",\"backup_remembered\":\"Copias registradas por esta instalación: {{count}} · ver la lista\",\"backup_sessions_scope\":\"Incluye los registros de reproducción de la CLI de todas las sesiones de este directorio de Kiro, no solo de los chats iniciados en {{productName}}.\",\"backup_run_now\":\"Copiar ahora\",\"backup_running\":\"Copiando…\",\"backup_failed\":\"La última copia falló: {{reason}}\",\"backup_start_failed\":\"No se pudo iniciar la copia de seguridad.\",\"backup_start_retry\":\"No se pudo iniciar la copia de seguridad. Inténtalo de nuevo.\",\"backup_start_unavailable\":\"Las copias de seguridad no están disponibles para esta aplicación. Comprueba que el entorno de trabajos esté registrado.\",\"backup_start_consent\":\"Concede acceso a S3 para esta cuenta y luego inicia la copia de seguridad.\",\"backup_start_no_drive\":\"Esta cuenta aún no tiene unidad. Crea una y luego inicia la copia de seguridad.\",\"backup_nightly\":\"Copiar cada noche\",\"backup_nightly_hint\":\"Ejecuta una copia de la memoria y el espacio de trabajo una vez al día.\",\"backup_nightly_blocked_other_account\":\"Las instantáneas nocturnas solo se ejecutan para la cuenta predeterminada, así que no se respalda nada de esta cuenta.\",\"backup_nightly_sessions\":\"Copiar las sesiones cada noche\",\"backup_nightly_sessions_hint\":\"Sube el archivo de sesiones a la unidad de esta cuenta una vez al día. Contiene tus conversaciones tal cual, sin quitar nada.\",\"backup_nightly_sessions_destination\":\"Esa unidad es almacenamiento S3 en esta cuenta de AWS, y {{button}} envía el archivo al mismo lugar.\",\"backup_nightly_sessions_blocked_host\":\"Este equipo no puede crear el archivo de sesiones, así que no se sube nada.\",\"backup_nightly_sessions_blocked_redaction\":\"La ocultación de datos salientes está activada y el archivo de sesiones aún no se puede ocultar, así que no se sube nada.\",\"backup_nightly_sessions_blocked_other_account\":\"Las subidas nocturnas solo se ejecutan para la cuenta predeterminada, así que no se sube nada de esta cuenta.\",\"backup_nightly_sessions_blocked_other\":\"Las subidas nocturnas están en pausa en este equipo, así que no se sube nada.\",\"backup_nightly_sessions_blocked_next\":\"Aún puedes iniciar la copia de seguridad tú mismo.\",\"backup_nightly_sessions_blocked_next_redaction\":\"Aún puedes iniciar la copia de seguridad tú mismo, pero el archivo de sesiones se sube sin ocultar.\",\"backup_archive\":\"Copias almacenadas\",\"backup_restore\":\"Restaurar\",\"backup_show_all_archives\":\"Mostrar todo ({{count}})\",\"backup_restore_caveat\":\"La restauración necesita acceso de lectura a la carpeta de copias de seguridad. La política de privilegios mínimos recomendada concede deliberadamente solo escritura, por lo que se denegará a menos que las credenciales de la cuenta sean más amplias.\",\"backup_remote_error\":\"No se pudieron leer las copias almacenadas ahora mismo.\",\"backup_status_failed\":\"No se pudo leer el estado de las copias de seguridad.\",\"backup_nightly_failed\":\"No se pudo cambiar «{{setting}}». Sigue igual.\",\"backup_restore_failed\":\"No se pudo restaurar esa copia. No se escribió nada.\",\"backup_restored_note\":\"Tus datos actuales no se sustituyeron. La copia se descargó a una carpeta de preparación en la ruta de abajo.\",\"backup_restore_recovered_note\":\"Se descargó la subida de esta misma instalación y se comprobó contra lo que registró. Otra cosa la había sobrescrito en la unidad y puede hacer lo mismo con tu próxima subida. Empieza por las otras instalaciones que esta página muestra haciendo copias en esta unidad.\",\"backup_install\":\"Esta instalación\",\"backup_install_hint\":\"Cada instalación guarda sus copias con su propio nombre, para que una restauración pueda distinguir los archivos de esta instalación de los de otra instalación.\",\"backup_install_rename\":\"Cambiar nombre\",\"backup_install_save\":\"Guardar nombre\",\"backup_install_rename_failed\":\"No se pudo guardar el nombre de la instalación. Sigue igual.\",\"backup_install_name_label\":\"Nombre de la instalación\",\"backup_attribution_self\":\"{{label}} · esta instalación\",\"backup_attribution_self_unnamed\":\"esta instalación\",\"backup_attribution_other\":\"\\\"{{label}}\\\" (otra instalación · {{id}})\",\"backup_attribution_other_unnamed\":\"otra instalación · {{id}}\",\"backup_attribution_unverified\":\"origen no verificado\",\"backup_origin_unknown\":\"origen desconocido\",\"backup_none_from_this_install\":\"No hay copias de esta instalación. Incluye los archivos de otras instalaciones para ver los de ellas.\",\"backup_others_on_drive\":\"Otras instalaciones que respaldan en esta unidad: {{count}}\",\"backup_show_others\":\"Incluir archivos de otras instalaciones\",\"backup_others_truncated\":\"Solo se muestran las primeras {{max}} instalaciones.\",\"backup_archives_truncated\":\"No se pudieron listar algunos archivos de {{kind}}. Puede que falten los más recientes.\",\"backup_shared_note\":\"Una unidad compartida por dos instalaciones no es memoria compartida ni sesiones compartidas. Cada copia es un archivo separado de un momento, y una restauración solo descarga ese archivo a una carpeta de preparación: los archivos los reemplazas tú, con el gateway detenido.\",\"backup_restore_foreign_confirm\":\"Este archivo lo subió otra instalación ({{install}}). Restaurarlo descarga los datos de esa instalación, no los de esta instalación. ¿Descargarlo de todos modos?\",\"backup_restore_unverified_confirm\":\"Este archivo está guardado en la carpeta propia de esta instalación, pero esta instalación no tiene registro de haberlo subido. Cualquiera que pueda escribir en la unidad puede crear esa carpeta, así que puede que no sea de esta instalación. ¿Descargarlo de todos modos?\",\"backup_restore_unknown_confirm\":\"Este archivo se subió antes de que las instalaciones tuvieran nombre, así que se desconoce qué instalación lo escribió. ¿Descargarlo de todos modos?\",\"backup_restore_overwritten_confirm\":\"Esta instalación subió este archivo, pero la unidad ya no contiene lo que subió: otra cosa lo ha sobrescrito desde entonces. ¿Descargarlo de todos modos?\",\"backup_restore_overwritten_refused\":\"Esta instalación subió este archivo, pero la unidad ya no contiene lo que subió. Para descargarlo de todos modos, abre Copias almacenadas y elige Descargarlo.\",\"backup_restore_foreign_refused\":\"Ese archivo pertenece a otra instalación. Confirma la restauración para descargarlo de todos modos.\",\"backup_restore_confirm_yes\":\"Descargarlo\",\"backup_restore_confirm_no\":\"Cancelar\",\"access_title\":\"Enlaces compartidos\",\"access_empty\":\"No hay enlaces de uso compartido activos.\",\"access_expires_in\":\"caduca {{when}}\",\"access_forget\":\"Quitar de la lista\",\"access_object_missing\":\"Archivo eliminado\",\"access_unchecked\":\"Estos enlaces no se han comprobado con la unidad, así que un archivo eliminado no se marca aquí.\",\"access_footer\":\"Quitar un enlace de la lista no lo revoca: un enlace compartido sigue funcionando hasta que caduque.\",\"access_list_failed\":\"No se pudieron leer los enlaces compartidos.\",\"access_forget_failed\":\"No se pudo quitar ese enlace de la lista. Sigue en la lista.\",\"keys_count_one\":\"{{count}} clave\",\"keys_count_other\":\"{{count}} claves\",\"keys_count_many\":\"{{count}} claves\",\"keys_for_account\":\"Claves de {{name}}\",\"key_healthy\":\"Correcta\",\"parent_folders\":\"Carpetas superiores\",\"folder_actions\":\"Acciones de carpeta\",\"file_actions\":\"Acciones de archivo\",\"root_storage_used\":\"Qué ocupa el almacenamiento\",\"root_section_objects_one\":\"{{objects}} elemento\",\"root_section_objects_other\":\"{{objects}} elementos\",\"root_section_objects_many\":\"{{objects}} elementos\",\"view_grid\":\"Vista de cuadrícula\",\"view_list\":\"Vista de lista\",\"library_add\":\"Añadir desde Artefactos\",\"library_add_one\":\"Añadir a Biblioteca de artefactos\",\"folder_open\":\"Abrir la carpeta {{name}}\",\"library_adding\":\"Añadiendo…\",\"library_add_oneway\":\"Las copias ocupan almacenamiento en la nube.\",\"library_add_again\":\"Añadir de nuevo\",\"library_add_count\":\"Añadir desde Artefactos ({{count}} listos)\",\"library_add_nothing\":\"No queda nada por añadir: todo lo que puede estar ya está aquí.\",\"library_list_failed\":\"No se pudo leer lo que hay en la nube.\",\"files_list_failed\":\"No se pudo leer esta carpeta.\",\"library_local_failed\":\"No se pudieron leer tus artefactos.\",\"retry\":\"Reintentar\",\"library_add_none\":\"Ningún artefacto coincide.\",\"library_update\":\"Actualizar copia\",\"library_search\":\"Busca tus artefactos\",\"library_push_failed\":\"No se pudo añadir este artefacto. Inténtalo de nuevo.\",\"library_blurb\":\"Cosas que Kiro creó para ti, copiadas a la nube. Los archivos que subes tú viven en Archivos.\",\"library_empty_title\":\"Aún no hay nada copiado en la nube\",\"library_empty_body\":\"Esta carpeta contiene cosas que Kiro creó para ti —widgets, páginas, documentos— una vez que las copias a la nube. Los archivos que subes desde tu equipo van en Archivos.\",\"library_cloud_only\":\"Solo en la nube\",\"library_in_cloud\":\"En la nube\",\"library_stale_preview\":\"La copia en la nube es v{{version}}; la vista previa muestra tu copia local más reciente\",\"library_stale_list\":\"La copia en la nube es v{{version}}; tu copia local es más reciente\",\"library_added\":\"Añadido {{when}}\",\"library_open\":\"Abrir {{name}} en Artefactos\",\"files_empty_title\":\"Archivos está vacío\",\"files_empty_body\":\"Esta carpeta contiene archivos que subes desde tu equipo. Está separada de Biblioteca de artefactos, que contiene las cosas que Kiro creó para ti.\",\"library_remove\":\"Quitar\",\"library_remove_confirm\":\"¿Quitar “{{name}}” de la biblioteca en la nube?\",\"library_remove_confirm_slug\":\"Esto vacía la carpeta en la nube <folder>{{folder}}</folder>.\",\"library_actions\":\"Acciones del elemento de la biblioteca\",\"library_remove_action\":\"Quitar la copia\",\"library_removing\":\"Quitando…\",\"library_remove_failed\":\"No se pudo quitar: la copia en la nube no ha cambiado. Inténtalo de nuevo.\",\"move_conflict\":\"La carpeta de destino ya tiene un archivo con este nombre. Elige otra carpeta o cambia primero el nombre del archivo.\",\"move_shared\":\"Este archivo tiene un enlace de uso compartido activo: moverlo rompería el enlace. Elimina el enlace (o deja que caduque) e inténtalo de nuevo.\",\"rename\":\"Cambiar nombre\",\"preview_truncated\":\"Archivo grande: solo se muestra el principio.\",\"preview_redacted\":\"Los valores sensibles están enmascarados en esta vista previa.\",\"preview_unsupported\":\"Este tipo de archivo no se puede previsualizar. Descárgalo para verlo.\",\"preview_failed\":\"No se pudo cargar la vista previa. Descarga el archivo para verlo o inténtalo de nuevo.\",\"search_files\":\"Buscar por nombre de archivo o ruta…\",\"search_clear\":\"Borrar búsqueda\",\"search_pending\":\"Buscando…\",\"search_capped\":\"Demasiadas coincidencias: se muestran las primeras {{count}}.\",\"search_failed\":\"La búsqueda falló. Inténtalo de nuevo.\",\"search_goto\":\"Abrir carpeta contenedora\",\"move_failed\":\"No se pudo mover el archivo. Inténtalo de nuevo.\",\"rename_conflict\":\"Ya existe un archivo con este nombre aquí.\",\"rename_shared\":\"Este archivo tiene un enlace compartido activo: cambiarle el nombre rompería el enlace. Elimina el recurso compartido (o deja que caduque) e inténtalo de nuevo.\",\"rename_failed\":\"No se pudo cambiar el nombre del archivo. Inténtalo de nuevo.\",\"rename_failed_named\":\"No se pudo cambiar el nombre de «{{name}}»: {{reason}}\",\"library_add_empty\":\"Aún no hay artefactos. Lo que Kiro cree para ti aparecerá aquí, listo para copiarse a la nube.\",\"move_to\":\"Mover a una carpeta…\",\"move_title\":\"Mover «{{name}}» a\",\"move_root\":\"Archivos (nivel superior)\",\"move_up\":\"Subir a {{name}}\",\"move_no_folders\":\"Aquí no hay otra carpeta a la que moverlo. Crea una primero.\",\"move_moving\":\"Moviendo…\",\"move_moving_picker\":\"Moviendo… Cerrar esto no cancela el movimiento.\",\"move_to_busy\":\"Todavía se está moviendo otro archivo\",\"move_ask_agent\":\"Preguntar al agente sobre este movimiento\",\"stat_storage\":\"Almacenamiento\",\"stat_objects\":\"Objetos\",\"key_needs_attention\":\"Necesita atención\",\"backup_state_current\":\"Con copia\",\"backup_state_never\":\"Nunca ejecutado\",\"costs_refresh_failed\":\"La última lectura de la factura falló. Esta es la cifra en caché.\"},\"page\":{\"refresh\":\"Actualizar\",\"health_ok\":\"Correcto\",\"health_degraded\":\"Requiere atención\",\"health_unknown\":\"Desconocido\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Proceso de credenciales\",\"kind_other\":\"Otro\",\"default_profile\":\"Perfil predeterminado\",\"not_connected_yet\":\"Aún sin conectar\",\"reconnect\":\"Reconectar\",\"reconnect_loading\":\"Cargando instrucciones para reconectar…\",\"reconnect_error\":\"No se pudieron cargar las instrucciones para reconectar.\",\"reconnect_hint_sso\":\"Vuelva a iniciar sesión para renovar esta conexión y luego actualice esta página.\",\"reconnect_hint_credential_process\":\"Ejecute este comando en su terminal para renovar las credenciales y luego actualice esta página.\",\"reconnect_hint_other\":\"Ejecute este comando en su terminal para restaurar la conexión y luego actualice esta página.\",\"copy\":\"Copiar\",\"copied\":\"Copiado\",\"empty_title\":\"Aún no hay cuentas\",\"empty_body\":\"Registra uno de los perfiles de AWS de esta máquina en Añadir cuentas, más abajo, y su cuenta aparecerá aquí.\",\"error_title\":\"No se pudieron cargar sus cuentas.\",\"error_body\":\"Algo salió mal al leer la lista de cuentas. Inténtelo de nuevo en un momento.\",\"error_forbidden_body\":\"Esta sesión del panel no es la del propietario, así que no puede administrar cuentas de AWS. Inicia sesión como propietario e inténtalo de nuevo.\",\"retry\":\"Reintentar\",\"disabled_title\":\"AWS Control está desactivado\",\"disabled_body\":\"Active la aplicación desde la App Store para ver sus cuentas.\",\"aggregate_accounts_one\":\"{{count}} cuenta\",\"aggregate_accounts_other\":\"{{count}} cuentas\",\"aggregate_keys_one\":\"{{count}} clave\",\"aggregate_keys_other\":\"{{count}} claves\",\"aggregate_healthy_one\":\"{{count}} correcta\",\"aggregate_healthy_other\":\"{{count}} correctas\",\"keys_summary_one\":\"{{count}} clave\",\"keys_summary_other\":\"{{count}} claves\",\"add_accounts_title\":\"Añadir cuentas\",\"add_accounts_summary\":\"Registrar más perfiles de AWS de esta máquina\",\"add_accounts_intro\":\"Estos perfiles locales de AWS aún no están registrados. Cada uno que añadas se convierte en una clave de su cuenta.\",\"add_accounts_search_placeholder\":\"Buscar perfiles\",\"add_accounts_search_keeps_selected\":\"Los perfiles que has seleccionado siguen en la lista aunque no coincidan.\",\"add_accounts_none\":\"Todos los perfiles locales ya están registrados.\",\"add_accounts_no_profiles\":\"Esta máquina aún no tiene perfiles de AWS. Crea uno primero (por ejemplo, ejecuta aws configure en un terminal) y luego regístralo aquí.\",\"add_accounts_unsupported\":\"AWS Control no puede acceder a los perfiles de AWS de esta máquina en Windows: su acceso a AWS necesita un shell de Linux o macOS. Ejecuta el gateway de {{productName}} en WSL (Windows Subsystem for Linux) y registra ahí los perfiles que configures.\",\"add_accounts_count_one\":\"{{count}} de {{max}} registrado\",\"add_accounts_count_other\":\"{{count}} de {{max}} registrados\",\"add_accounts_cap_reached\":\"Has alcanzado el límite de {{max}} claves. Elimina una antes de añadir más.\",\"add_accounts_register\":\"Registrar seleccionados\",\"add_accounts_registering\":\"Registrando…\",\"add_accounts_error\":\"No se pudieron registrar esos perfiles. No se añadió nada. Vuelve a intentarlo.\",\"add_accounts_load_error\":\"No se pudieron listar los perfiles de AWS locales.\",\"search_placeholder\":\"Buscar cuentas\",\"aggregate_accounts_many\":\"{{count}} cuentas\",\"aggregate_keys_many\":\"{{count}} claves\",\"aggregate_healthy_many\":\"{{count}} correctas\",\"keys_summary_many\":\"{{count}} claves\",\"add_accounts_count_many\":\"{{count}} de {{max}} registrados\",\"paid_services_title\":\"Servicios de pago\",\"orphan_consent\":\"Confirmado para una cuenta de AWS que no está registrada aquí. Retira la confirmación abajo, o vuelve a registrar esa cuenta para gestionarla desde su propia página.\",\"account_actions\":\"Acciones de la cuenta\",\"remove_account\":\"Quitar de AWS Control…\",\"remove_account_action\":\"Quitar\",\"remove_account_confirm\":\"¿Quitar “{{name}}” de AWS Control? Nada cambia en AWS ni en tu configuración de la CLI de AWS.\",\"remove_account_error\":\"No se pudo quitar la cuenta.\",\"remove_account_hint\":\"Nada cambia en AWS\",\"forget_key_confirm\":\"¿Olvidar la clave “{{name}}” de esta fila? Nada cambia en AWS ni en tu configuración de la CLI de AWS.\",\"forget_key_action\":\"Olvidar clave\",\"totals_summary_one\":\"{{accounts}} cuenta · {{keys}}\",\"totals_summary_many\":\"{{accounts}} cuentas · {{keys}}\",\"totals_summary_other\":\"{{accounts}} cuentas · {{keys}}\",\"keys_healthy_one\":\"{{healthy}} de {{n}} clave en buen estado\",\"keys_healthy_many\":\"{{healthy}} de {{n}} claves en buen estado\",\"keys_healthy_other\":\"{{healthy}} de {{n}} claves en buen estado\"},\"rail\":{\"accounts\":\"Cuentas y credenciales\",\"nav\":\"Secciones de AWS Control\",\"switch_account\":\"Cambiar de cuenta\",\"usage\":\"Uso y costos\",\"use_account\":\"Usar esta cuenta\"},\"overview\":{\"title\":\"Resumen\",\"subtitle\":\"Un solo lugar para las cuentas, las claves, la unidad en la nube y los servicios de pago que pueden usar tus agentes.\",\"stat_accounts\":\"Cuentas\",\"stat_accounts_attention_one\":\"{{count}} necesita atención\",\"stat_accounts_attention_other\":\"{{count}} necesitan atención\",\"stat_accounts_all_ok\":\"Todo correcto\",\"stat_keys\":\"Claves en orden\",\"stat_keys_sub_one\":\"{{count}} clave registrada\",\"stat_keys_sub_other\":\"{{count}} claves registradas\",\"stat_drive\":\"Unidad usada\",\"stat_drive_none\":\"Sin unidad aún\",\"stat_spend\":\"Mes en curso\",\"stat_spend_consent\":\"Informe de costes desactivado\",\"stat_shares_none\":\"Nada compartido\",\"stat_shares_sub_one\":\"{{count}} enlace activo\",\"stat_shares_sub_other\":\"{{count}} enlaces activos\",\"stat_backups_nightly\":\"Cada noche\",\"stat_backups_manual\":\"Manual\",\"stat_backups_sub_nightly\":\"Se ejecuta cada noche\",\"stat_backups_sub_manual\":\"Sin programación\",\"accounts_title\":\"Cuentas\",\"accounts_note\":\"Los agentes usan estas claves sin verlas nunca. Nada de una clave aparece en un chat.\",\"add_account\":\"Añadir cuenta\",\"drive_title\":\"Unidad en la nube\",\"drive_bar_label\":\"{{size}} almacenados, repartidos entre archivos, la biblioteca de artefactos y las copias de seguridad\",\"drive_empty_title\":\"Aún no hay unidad en la nube\",\"drive_empty_body\":\"Crea en esta cuenta un único bucket privado y cifrado para tus archivos, la biblioteca de artefactos y las copias de seguridad.\",\"drive_setup\":\"Configurar unidad en la nube\",\"stat_accounts_attention_many\":\"{{count}} necesitan atención\",\"stat_keys_sub_many\":\"{{count}} claves registradas\",\"stat_shares_sub_many\":\"{{count}} enlaces activos\",\"drive_bucket_label\":\"Bucket\",\"stat_spend_scope\":\"Factura de AWS de esta cuenta\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "Confirma el uso de AWS antes de la primera solicitud",
				"confirmed_title": "Uso de AWS confirmado",
				"account_changed": "Esto se confirmo para otra cuenta de AWS, por lo que se retiro la confirmacion. Revisa la cuenta de abajo y vuelve a confirmar.",
				"service": "Servicio",
				"region": "Region",
				"credential_source": "Origen de las credenciales",
				"aws_account": "Cuenta de AWS",
				"provider_default": "(valor predeterminado del proveedor)",
				"unresolved_account": "no se pudo resolver",
				"billing_notice": "Este es un servicio de AWS de pago. Hasta que lo confirmes, no se envia ninguna solicitud.",
				"confirm_button": "Confirmar y activar",
				"withdraw": "Retirar la confirmacion",
				"status_failed": "No se pudo leer el estado de la confirmación.",
				"confirm_failed": "La confirmación no se registró.",
				"withdraw_failed": "La confirmación no se retiró.",
				"retry": "Reintentar",
				"badge_confirmed": "Confirmado",
				"badge_not_enabled": "No activado",
				"confirmed_on": "confirmado el {{date}}",
				"billing_notice_short": "Con coste. No se envía nada hasta que lo confirmes.",
				"pending_profile_hint": "Termina de escribir el perfil de AWS para confirmar.",
				"bedrock_kb_billing_short": "Se factura en cada búsqueda: una llamada Bedrock Retrieve por Knowledge Base",
				"aws_pricing_link": "Precios de AWS",
				"withdraw_effect": "Al retirarla, los agentes dejan de usar este servicio hasta que vuelvas a confirmar."
			},
			"ui": {
				"clear_filter": "Borrar filtro",
				"no_matches_for": "Sin coincidencias para",
				"no_noun_match": "No hay {{noun}} que coincidan"
			}
		}
	},
	fr: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"Vos comptes cloud, en langage clair. Voyez chaque compte AWS que Kiro Crew peut utiliser, avec un voyant de santé par compte et des conseils de reconnexion adaptés, ainsi qu'un disque cloud sur S3 — fichiers, bibliothèque d'artefacts cloud et sauvegardes — avec des liens de partage à durée limitée. Rien n'est public sauf si vous le décidez, et chaque service payant demande votre confirmation avant de pouvoir vous facturer.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"Un voyant de santé par compte, chacun avec des conseils de reconnexion adaptés au mode d'authentification du profil\",\"highlight_2\":\"Un stockage privé, chiffré et versionné, créé uniquement après votre confirmation\",\"highlight_3\":\"Votre bibliothèque d'artefacts cloud, vos fichiers et vos sauvegardes réunis sur un seul bucket qui vous appartient\",\"highlight_4\":\"Les liens de partage expirent toujours — rien n'est public sauf si vous le décidez\",\"highlight_5\":\"Chaque service payant est confirmé par compte avant sa première utilisation, et chaque changement est consigné\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Vois chaque compte AWS que Kiro Crew peut atteindre, lesquels sont en bonne santé et ce que ce mois te coûte -- sans ouvrir la console AWS.\",\"configuration_1\":\"Ajoute un compte depuis les profils déjà présents sur cette machine, puis confirme chaque service payant une fois par compte avant sa première utilisation.\"},\"console\":{\"copy\":\"Copier\",\"copied\":\"Copié\",\"close\":\"Fermer\",\"loading\":\"Chargement…\",\"download\":\"Télécharger\",\"share\":\"Partager\",\"delete\":\"Supprimer\",\"delete_failed\":\"Échec de la suppression — le fichier est intact. Réessayez.\",\"delete_failed_named\":\"Impossible de supprimer « {{name}} » : le fichier est inchangé. Réessayez.\",\"download_failed\":\"Le téléchargement n'a pas pu démarrer. Rien n'a été envoyé. Réessayez.\",\"delete_confirm_action\":\"Supprimer le fichier\",\"delete_confirm\":\"Supprimer « {{name}} » ? Le fichier est retiré du drive.\",\"col_name\":\"Nom\",\"col_kind\":\"Type\",\"col_size\":\"Taille\",\"col_modified\":\"Modifié\",\"col_actions\":\"Actions\",\"kind_folder\":\"Dossier\",\"folder_new\":\"Nouveau dossier\",\"folder_name\":\"Nom du dossier\",\"folder_delete_confirm\":\"Supprimer « {{name}} » et tout son contenu ?\",\"folder_delete_action\":\"Supprimer le dossier\",\"folder_delete_failed\":\"Impossible de supprimer le dossier.\",\"folder_create_failed\":\"Impossible de créer le dossier.\",\"folder_bad_name\":\"Ce nom de dossier contient des caractères que le disque ne peut pas stocker. Les lettres, chiffres, espaces et . _ - ( ) + @ = sont sûrs.\",\"folder_deleted_one\":\"« {{name}} » supprimé : {{count}} élément.\",\"folder_deleted_other\":\"« {{name}} » supprimé : {{count}} éléments.\",\"folder_deleted_many\":\"« {{name}} » supprimé : {{count}} éléments.\",\"cancel\":\"Annuler\",\"load_more\":\"Afficher plus\",\"stat_this_month\":\"Ce mois-ci\",\"storage_consent_needed\":\"Le stockage cloud de ce compte n'est pas encore confirmé. Confirmez-le ci-dessous, puis actualisez la page.\",\"stat_stored_value\":\"{{size}} · {{objects}} éléments\",\"costs_as_of\":\"Chiffres en cache, au {{date}}.\",\"costs_consent_missing\":\"Activez le suivi des coûts ci-dessous pour voir les dépenses de ce compte.\",\"costs_unavailable\":\"Impossible de lire la facture pour le moment.\",\"account_unavailable\":\"Ce compte est injoignable pour le moment. Reconnectez-le, puis revenez.\",\"drive_status_failed\":\"Impossible de lire le disque pour le moment.\",\"setup_title\":\"Configurer un disque cloud\",\"setup_body\":\"Ceci crée un bucket de stockage privé, chiffré et versionné dans votre propre compte, pour vos fichiers, votre bibliothèque d'artefacts et vos sauvegardes.\",\"setup_searched_region\":\"Aucun disque trouvé dans {{region}}. Seule cette région a été cherchée : un disque dans une autre région de ce compte n’apparaîtra pas ici.\",\"setup_costs_note\":\"Les coûts suivent l'usage : vous payez AWS pour ce que vous stockez, et rien avant cela.\",\"setup_preview_region\":\"Région\",\"setup_preview_resource\":\"Ressource\",\"setup_preview_btn\":\"Aperçu\",\"setup_confirm_btn\":\"Créer\",\"setup_creating\":\"Création…\",\"setup_error\":\"Impossible de préparer le disque. Réessayez dans un instant.\",\"setup_confirm_error\":\"Impossible de créer le disque. Rien n'a été modifié : vérifiez les autorisations ci-dessous et réessayez.\",\"setup_policy_error\":\"Impossible de charger les autorisations à coller.\",\"setup_policy_label\":\"Afficher les autorisations exactes à coller\",\"library_all\":\"Tout\",\"library_not_pushable\":\"Les images ne peuvent pas encore être copiées dans le cloud.\",\"kind_widget\":\"Widget\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Texte\",\"kind_webapp\":\"Application web\",\"kind_image\":\"Image\",\"drive_title\":\"Disque\",\"drive_upload\":\"Téléverser\",\"drive_uploading\":\"Téléversement…\",\"drive_bad_name\":\"Ce nom de fichier contient des caractères que le disque ne peut pas stocker. Les lettres, chiffres, espaces et . _ - ( ) + @ = sont sûrs.\",\"rename_bad_name\":\"Ce nom contient des caractères que le disque ne peut pas stocker. Modifiez le nom et réessayez.\",\"drive_bad_name_named\":\"Impossible d’importer « {{name}} » : le nom contient des caractères que le disque ne peut pas stocker. Les lettres, chiffres, espaces et . _ - ( ) + @ = sont sûrs.\",\"drive_upload_failed\":\"«\xA0{{name}}\xA0» n’a pas pu être importé. Réessayez.\",\"section_files\":\"Fichiers\",\"section_library\":\"Bibliothèque d’artefacts\",\"section_backup\":\"Sauvegarde\",\"share_title\":\"Partager « {{name}} »\",\"share_expiry\":\"Le lien expire après\",\"share_note\":\"Note\",\"share_note_placeholder\":\"À quoi sert ce lien ?\",\"share_create\":\"Créer le lien\",\"share_creating\":\"Création…\",\"share_failed\":\"Impossible de créer le lien de partage. Rien n'a été partagé.\",\"expiry_1h\":\"1 heure\",\"expiry_1d\":\"1 jour\",\"expiry_7d\":\"7 jours\",\"share_expires_note\":\"Le lien cesse de fonctionner à son expiration et ne peut pas être révoqué plus tôt.\",\"share_credentials_caveat\":\"Il peut cesser de fonctionner plus tôt si la session de connexion du compte se termine avant.\",\"cli_drawer_label\":\"Où cela réside\",\"cli_drawer_hint\":\"Ces fichiers résident sous {{prefix}} dans le bucket {{bucket}}. Cette commande les liste depuis un terminal disposant de vos identifiants.\",\"backup_title\":\"Sauvegarde\",\"backup_kind_snapshot\":\"Mémoire et espace de travail\",\"backup_kind_sessions\":\"Archive des sessions\",\"backup_last_run\":\"Dernière sauvegarde {{when}} · {{size}}\",\"backup_never\":\"Pas encore sauvegardé\",\"backup_never_recorded\":\"Aucune exécution enregistrée ici — des archives antérieures peuvent encore être sur le lecteur\",\"backup_remembered\":\"Archives enregistrées par cette installation : {{count}} · afficher la liste\",\"backup_sessions_scope\":\"Inclut les journaux de relecture CLI de chaque session de ce dossier Kiro, pas seulement des conversations démarrées dans {{productName}}.\",\"backup_run_now\":\"Sauvegarder maintenant\",\"backup_running\":\"Sauvegarde…\",\"backup_failed\":\"Dernière sauvegarde échouée : {{reason}}\",\"backup_start_failed\":\"Impossible de démarrer la sauvegarde.\",\"backup_start_retry\":\"Impossible de démarrer la sauvegarde. Réessayez.\",\"backup_start_unavailable\":\"Les sauvegardes ne sont pas disponibles pour cette application. Vérifiez que le moteur de tâches est enregistré.\",\"backup_start_consent\":\"Accordez l'accès S3 pour ce compte, puis démarrez la sauvegarde.\",\"backup_start_no_drive\":\"Ce compte n'a pas encore de disque. Créez-en un, puis démarrez la sauvegarde.\",\"backup_nightly\":\"Sauvegarder chaque nuit\",\"backup_nightly_hint\":\"Effectue un instantané de la mémoire et de l'espace de travail une fois par jour.\",\"backup_nightly_blocked_other_account\":\"Les instantanés nocturnes ne s’exécutent que pour le compte par défaut, donc rien n’est sauvegardé pour ce compte.\",\"backup_nightly_sessions\":\"Sauvegarder les sessions chaque nuit\",\"backup_nightly_sessions_hint\":\"Envoie l’archive des sessions vers le lecteur de ce compte une fois par jour. Elle contient vos conversations telles quelles, sans rien retirer.\",\"backup_nightly_sessions_destination\":\"Ce lecteur est un stockage S3 dans ce compte AWS, et {{button}} envoie l’archive au même endroit.\",\"backup_nightly_sessions_blocked_host\":\"Cet ordinateur ne peut pas créer l’archive des sessions, donc rien n’est envoyé.\",\"backup_nightly_sessions_blocked_redaction\":\"Le masquage des données sortantes est activé et l’archive des sessions ne peut pas encore être masquée, donc rien n’est envoyé.\",\"backup_nightly_sessions_blocked_other_account\":\"Les envois nocturnes ne s’exécutent que pour le compte par défaut, donc rien n’est envoyé pour ce compte.\",\"backup_nightly_sessions_blocked_other\":\"Les envois nocturnes sont suspendus sur cet ordinateur, donc rien n’est envoyé.\",\"backup_nightly_sessions_blocked_next\":\"Vous pouvez toujours démarrer la sauvegarde vous-même.\",\"backup_nightly_sessions_blocked_next_redaction\":\"Vous pouvez toujours démarrer la sauvegarde vous-même, mais l’archive des sessions est alors envoyée sans masquage.\",\"backup_archive\":\"Sauvegardes stockées\",\"backup_restore\":\"Restaurer\",\"backup_show_all_archives\":\"Tout afficher ({{count}})\",\"backup_restore_caveat\":\"La restauration nécessite un accès en lecture au dossier de sauvegarde. La stratégie de moindre privilège recommandée n'accorde volontairement que l'écriture, elle sera donc refusée sauf si les identifiants du compte sont plus étendus.\",\"backup_remote_error\":\"Impossible de lire les sauvegardes stockées pour le moment.\",\"backup_status_failed\":\"Impossible de lire l'état des sauvegardes.\",\"backup_nightly_failed\":\"Impossible de modifier «\xA0{{setting}}\xA0». Le réglage est inchangé.\",\"backup_restore_failed\":\"Impossible de restaurer cette sauvegarde. Rien n'a été écrit.\",\"backup_restored_note\":\"Vos données actuelles n’ont pas été remplacées. La sauvegarde a été téléchargée dans un dossier de transit au chemin ci-dessous.\",\"backup_restore_recovered_note\":\"L’envoi de cette installation a été téléchargé et vérifié par rapport à ce qu’elle avait enregistré. Autre chose l’avait écrasé sur le lecteur et peut faire de même avec ton prochain envoi. Commence par les autres installations que cette page indique comme sauvegardant sur ce lecteur.\",\"backup_install\":\"Cette installation\",\"backup_install_hint\":\"Chaque installation stocke ses sauvegardes sous son propre nom, pour qu’une restauration puisse distinguer les archives de cette installation de celles d'une autre installation.\",\"backup_install_rename\":\"Renommer\",\"backup_install_save\":\"Enregistrer le nom\",\"backup_install_rename_failed\":\"Impossible d’enregistrer le nom de l’installation. Il est inchangé.\",\"backup_install_name_label\":\"Nom de l’installation\",\"backup_attribution_self\":\"{{label}} · cette installation\",\"backup_attribution_self_unnamed\":\"cette installation\",\"backup_attribution_other\":\"« {{label}} » (une autre installation · {{id}})\",\"backup_attribution_other_unnamed\":\"une autre installation · {{id}}\",\"backup_attribution_unverified\":\"origine non vérifiée\",\"backup_origin_unknown\":\"origine inconnue\",\"backup_none_from_this_install\":\"Aucune sauvegarde de cette installation. Inclus les archives d'autres installations pour voir les leurs.\",\"backup_others_on_drive\":\"Autres installations qui sauvegardent sur ce lecteur : {{count}}\",\"backup_show_others\":\"Inclure les archives d’autres installations\",\"backup_others_truncated\":\"Seules les {{max}} premières autres installations sont affichées.\",\"backup_archives_truncated\":\"Certaines archives de type {{kind}} n’ont pas pu être listées. Les plus récentes peuvent manquer ici.\",\"backup_shared_note\":\"Un lecteur partagé par deux installations n’est pas une mémoire partagée ni des sessions partagées. Chaque sauvegarde est une archive distincte d'un instant, et une restauration ne fait que télécharger ce fichier dans un dossier de transit — c'est toi qui remplaces les fichiers, le gateway arrêté.\",\"backup_restore_foreign_confirm\":\"Cette archive a été envoyée par une autre installation ({{install}}). La restaurer télécharge les données de cette autre installation, pas celles de cette installation-ci. La télécharger quand même ?\",\"backup_restore_unverified_confirm\":\"Cette archive est stockée dans le dossier propre à cette installation, mais cette installation n’a aucune trace de l’avoir envoyée. Tout ce qui peut écrire sur le lecteur peut créer ce dossier, elle ne provient donc peut-être pas de cette installation. La télécharger quand même ?\",\"backup_restore_unknown_confirm\":\"Cette archive a été envoyée avant que les installations soient nommées, on ignore donc quelle installation l'a écrite. La télécharger quand même ?\",\"backup_restore_overwritten_confirm\":\"Cette installation a envoyé cette archive, mais le lecteur ne contient plus ce qu'elle a envoyé : autre chose l'a écrasée depuis. La télécharger quand même ?\",\"backup_restore_overwritten_refused\":\"Cette installation a envoyé cette archive, mais le lecteur ne contient plus ce qu'elle a envoyé. Pour la télécharger quand même, ouvre Sauvegardes stockées et choisis Télécharger.\",\"backup_restore_foreign_refused\":\"Cette archive appartient à une autre installation. Confirme la restauration pour la télécharger quand même.\",\"backup_restore_confirm_yes\":\"Télécharger\",\"backup_restore_confirm_no\":\"Annuler\",\"access_title\":\"Liens de partage\",\"access_empty\":\"Aucun lien de partage actif.\",\"access_expires_in\":\"expire {{when}}\",\"access_forget\":\"Retirer de la liste\",\"access_object_missing\":\"Fichier supprimé\",\"access_unchecked\":\"Ces liens n'ont pas été vérifiés auprès du drive : un fichier supprimé n'est donc pas signalé ici.\",\"access_footer\":\"Retirer un lien de la liste ne le révoque pas — un lien partagé fonctionne jusqu'à son expiration.\",\"access_list_failed\":\"Impossible de lire les liens de partage.\",\"access_forget_failed\":\"Impossible de retirer ce lien de la liste. Il y figure toujours.\",\"keys_count_one\":\"{{count}} clé\",\"keys_count_other\":\"{{count}} clés\",\"keys_count_many\":\"{{count}} clés\",\"keys_for_account\":\"Clés de {{name}}\",\"key_healthy\":\"Saine\",\"parent_folders\":\"Dossiers parents\",\"folder_actions\":\"Actions du dossier\",\"file_actions\":\"Actions du fichier\",\"root_storage_used\":\"Ce qui occupe le stockage\",\"root_section_objects_one\":\"{{objects}} élément\",\"root_section_objects_other\":\"{{objects}} éléments\",\"root_section_objects_many\":\"{{objects}} éléments\",\"view_grid\":\"Affichage en grille\",\"view_list\":\"Affichage en liste\",\"library_add\":\"Ajouter depuis les artefacts\",\"library_add_one\":\"Ajouter à la Bibliothèque d’artefacts\",\"folder_open\":\"Ouvrir le dossier {{name}}\",\"library_adding\":\"Ajout…\",\"library_add_oneway\":\"Les copies occupent du stockage cloud.\",\"library_add_again\":\"Ajouter de nouveau\",\"library_add_count\":\"Ajouter depuis les artefacts ({{count}} prêts)\",\"library_add_nothing\":\"Plus rien à ajouter : tout ce qui peut y être est déjà là.\",\"library_list_failed\":\"Impossible de lire le contenu du cloud.\",\"files_list_failed\":\"Impossible de lire ce dossier.\",\"library_local_failed\":\"Impossible de lire vos artefacts.\",\"retry\":\"Réessayer\",\"library_add_none\":\"Aucun artefact ne correspond.\",\"library_update\":\"Mettre à jour la copie\",\"library_search\":\"Rechercher vos artefacts\",\"library_push_failed\":\"Impossible d’ajouter cet artefact. Réessayez.\",\"library_blurb\":\"Éléments créés par Kiro pour vous, copiés dans le cloud. Les fichiers que vous importez vous-même se trouvent dans Fichiers.\",\"library_empty_title\":\"Rien n’a encore été copié dans le cloud\",\"library_empty_body\":\"Ce dossier contient les éléments créés par Kiro pour vous – widgets, pages, documents – une fois que vous les copiez dans le cloud. Les fichiers importés depuis votre ordinateur vont plutôt dans Fichiers.\",\"library_cloud_only\":\"Dans le cloud uniquement\",\"library_in_cloud\":\"Dans le cloud\",\"library_stale_preview\":\"La copie dans le cloud est en v{{version}} ; l'aperçu montre votre copie locale plus récente\",\"library_stale_list\":\"La copie dans le cloud est en v{{version}} ; votre copie locale est plus récente\",\"library_added\":\"Ajouté {{when}}\",\"library_open\":\"Ouvrir {{name}} dans Artefacts\",\"files_empty_title\":\"Fichiers est vide\",\"files_empty_body\":\"Ce dossier contient les fichiers que vous importez depuis votre ordinateur. Il est distinct de Bibliothèque d’artefacts, qui contient les éléments créés par Kiro pour vous.\",\"library_remove\":\"Retirer\",\"library_remove_confirm\":\"Retirer « {{name}} » de la bibliothèque cloud ?\",\"library_remove_confirm_slug\":\"Cela vide le dossier cloud <folder>{{folder}}</folder>.\",\"library_actions\":\"Actions sur l'élément de bibliothèque\",\"library_remove_action\":\"Retirer la copie\",\"library_removing\":\"Retrait…\",\"library_remove_failed\":\"Échec du retrait — la copie cloud est intacte. Réessayez.\",\"move_conflict\":\"Le dossier de destination contient déjà un fichier portant ce nom. Choisis un autre dossier ou renomme d'abord le fichier.\",\"move_shared\":\"Ce fichier a un lien de partage actif\xA0: le déplacer casserait le lien. Supprimez le partage (ou laissez-le expirer), puis réessayez.\",\"rename\":\"Renommer\",\"preview_truncated\":\"Fichier volumineux : seul le début est affiché.\",\"preview_redacted\":\"Les valeurs sensibles sont masquées dans cet aperçu.\",\"preview_unsupported\":\"Ce type de fichier ne peut pas être prévisualisé. Téléchargez-le pour le consulter.\",\"preview_failed\":\"L’aperçu n’a pas pu être chargé. Téléchargez le fichier pour le consulter, ou réessayez.\",\"search_files\":\"Rechercher par nom de fichier ou chemin…\",\"search_clear\":\"Effacer la recherche\",\"search_pending\":\"Recherche en cours…\",\"search_capped\":\"Trop de résultats : seuls les {{count}} premiers sont affichés.\",\"search_failed\":\"La recherche a échoué. Réessayez.\",\"search_goto\":\"Ouvrir le dossier parent\",\"move_failed\":\"Impossible de déplacer le fichier. Réessayez.\",\"rename_conflict\":\"Un fichier portant ce nom existe déjà ici.\",\"rename_shared\":\"Ce fichier a un lien de partage actif : le renommer casserait le lien. Supprimez le partage (ou laissez-le expirer) et réessayez.\",\"rename_failed\":\"Impossible de renommer le fichier. Réessayez.\",\"rename_failed_named\":\"Impossible de renommer « {{name}} » : {{reason}}\",\"library_add_empty\":\"Aucun artefact pour l’instant. Ce que Kiro crée pour vous apparaîtra ici, prêt à être copié dans le cloud.\",\"move_to\":\"Déplacer vers un dossier…\",\"move_title\":\"Déplacer « {{name}} » vers\",\"move_root\":\"Fichiers (niveau supérieur)\",\"move_up\":\"Remonter vers {{name}}\",\"move_no_folders\":\"Il n’y a pas d’autre dossier ici où le déplacer. Créez-en un d’abord.\",\"move_moving\":\"Déplacement…\",\"move_moving_picker\":\"Déplacement… Fermer cette fenêtre n'annule pas le déplacement.\",\"move_to_busy\":\"Un autre déplacement est encore en cours\",\"move_ask_agent\":\"Demander à l'agent à propos de ce déplacement\",\"stat_storage\":\"Stockage\",\"stat_objects\":\"Objets\",\"key_needs_attention\":\"Action requise\",\"backup_state_current\":\"Sauvegardé\",\"backup_state_never\":\"Jamais exécuté\",\"costs_refresh_failed\":\"La dernière lecture de la facture a échoué. Ceci est la valeur en cache.\"},\"page\":{\"refresh\":\"Actualiser\",\"health_ok\":\"Sain\",\"health_degraded\":\"À vérifier\",\"health_unknown\":\"Inconnu\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Processus d'identifiants\",\"kind_other\":\"Autre\",\"default_profile\":\"Profil par défaut\",\"not_connected_yet\":\"Pas encore connecté\",\"reconnect\":\"Reconnecter\",\"reconnect_loading\":\"Chargement des indications de reconnexion…\",\"reconnect_error\":\"Impossible de charger les indications de reconnexion.\",\"reconnect_hint_sso\":\"Reconnectez-vous pour renouveler cette connexion, puis actualisez cette page.\",\"reconnect_hint_credential_process\":\"Exécutez cette commande dans votre terminal pour renouveler les identifiants, puis actualisez cette page.\",\"reconnect_hint_other\":\"Exécutez cette commande dans votre terminal pour rétablir la connexion, puis actualisez cette page.\",\"copy\":\"Copier\",\"copied\":\"Copié\",\"empty_title\":\"Aucun compte pour l'instant\",\"empty_body\":\"Enregistre un des profils AWS de cette machine dans Ajouter des comptes, plus bas, et son compte apparaîtra ici.\",\"error_title\":\"Impossible de charger vos comptes.\",\"error_body\":\"Une erreur s'est produite lors de la lecture de la liste des comptes. Réessayez dans un instant.\",\"error_forbidden_body\":\"Cette session du tableau de bord n'est pas celle du propriétaire, elle ne peut donc pas gérer les comptes AWS. Connectez-vous en tant que propriétaire, puis réessayez.\",\"retry\":\"Réessayer\",\"disabled_title\":\"AWS Control est désactivé\",\"disabled_body\":\"Activez l'application depuis l'App Store pour voir vos comptes.\",\"aggregate_accounts_one\":\"{{count}} compte\",\"aggregate_accounts_other\":\"{{count}} comptes\",\"aggregate_keys_one\":\"{{count}} clé\",\"aggregate_keys_other\":\"{{count}} clés\",\"aggregate_healthy_one\":\"{{count}} saine\",\"aggregate_healthy_other\":\"{{count}} saines\",\"keys_summary_one\":\"{{count}} clé\",\"keys_summary_other\":\"{{count}} clés\",\"add_accounts_title\":\"Ajouter des comptes\",\"add_accounts_summary\":\"Enregistrer d'autres profils AWS de cette machine\",\"add_accounts_intro\":\"Ces profils AWS locaux ne sont pas encore enregistrés. Chacun de ceux que tu ajoutes devient une clé de son compte.\",\"add_accounts_search_placeholder\":\"Rechercher des profils\",\"add_accounts_search_keeps_selected\":\"Les profils que tu as sélectionnés restent affichés même s’ils ne correspondent pas.\",\"add_accounts_none\":\"Tous les profils locaux sont déjà enregistrés.\",\"add_accounts_no_profiles\":\"Cette machine n'a encore aucun profil AWS. Crée-en un d'abord (par exemple, lance aws configure dans un terminal), puis enregistre-le ici.\",\"add_accounts_unsupported\":\"AWS Control n'accède pas aux profils AWS de cette machine sous Windows : son accès AWS exige un shell Linux ou macOS. Lance la passerelle {{productName}} sous WSL (Windows Subsystem for Linux), puis enregistre les profils configurés là-bas.\",\"add_accounts_count_one\":\"{{count}} sur {{max}} enregistré\",\"add_accounts_count_other\":\"{{count}} sur {{max}} enregistrés\",\"add_accounts_cap_reached\":\"Tu as atteint la limite de {{max}} clés. Supprime-en une avant d'en ajouter d'autres.\",\"add_accounts_register\":\"Enregistrer la sélection\",\"add_accounts_registering\":\"Enregistrement…\",\"add_accounts_error\":\"Ces profils n'ont pas pu être enregistrés. Rien n'a été ajouté. Réessaie.\",\"add_accounts_load_error\":\"Impossible de lister les profils AWS locaux.\",\"search_placeholder\":\"Rechercher des comptes\",\"aggregate_accounts_many\":\"{{count}} comptes\",\"aggregate_keys_many\":\"{{count}} clés\",\"aggregate_healthy_many\":\"{{count}} saines\",\"keys_summary_many\":\"{{count}} clés\",\"add_accounts_count_many\":\"{{count}} sur {{max}} enregistrés\",\"paid_services_title\":\"Services payants\",\"orphan_consent\":\"Confirmé pour un compte AWS qui n'est pas enregistré ici. Retirez la confirmation ci-dessous, ou enregistrez à nouveau ce compte pour le gérer depuis sa propre page.\",\"account_actions\":\"Actions du compte\",\"remove_account\":\"Retirer d'AWS Control…\",\"remove_account_action\":\"Retirer\",\"remove_account_confirm\":\"Retirer « {{name}} » d'AWS Control ? Rien ne change dans AWS ni dans votre configuration de l'AWS CLI.\",\"remove_account_error\":\"Le compte n'a pas pu être retiré.\",\"remove_account_hint\":\"Rien ne change dans AWS\",\"forget_key_confirm\":\"Oublier la clé « {{name}} » de cette ligne ? Rien ne change dans AWS ni dans votre configuration de l'AWS CLI.\",\"forget_key_action\":\"Oublier la clé\",\"totals_summary_one\":\"{{accounts}} compte · {{keys}}\",\"totals_summary_many\":\"{{accounts}} comptes · {{keys}}\",\"totals_summary_other\":\"{{accounts}} comptes · {{keys}}\",\"keys_healthy_one\":\"clés en bon état : {{healthy}}/{{n}}\",\"keys_healthy_many\":\"clés en bon état : {{healthy}}/{{n}}\",\"keys_healthy_other\":\"clés en bon état : {{healthy}}/{{n}}\"},\"rail\":{\"accounts\":\"Comptes et identifiants\",\"nav\":\"Sections d'AWS Control\",\"switch_account\":\"Changer de compte\",\"usage\":\"Utilisation et coûts\",\"use_account\":\"Utiliser ce compte\"},\"overview\":{\"title\":\"Aperçu\",\"subtitle\":\"Un seul endroit pour les comptes, les clés, le drive cloud et les services payants que vos agents peuvent utiliser.\",\"stat_accounts\":\"Comptes\",\"stat_accounts_attention_one\":\"{{count}} demande votre attention\",\"stat_accounts_attention_other\":\"{{count}} demandent votre attention\",\"stat_accounts_all_ok\":\"Tout va bien\",\"stat_keys\":\"Clés valides\",\"stat_keys_sub_one\":\"{{count}} clé enregistrée\",\"stat_keys_sub_other\":\"{{count}} clés enregistrées\",\"stat_drive\":\"Drive utilisé\",\"stat_drive_none\":\"Pas encore de drive\",\"stat_spend\":\"Mois en cours\",\"stat_spend_consent\":\"Rapport de coûts désactivé\",\"stat_shares_none\":\"Rien de partagé\",\"stat_shares_sub_one\":\"{{count}} lien actif\",\"stat_shares_sub_other\":\"{{count}} liens actifs\",\"stat_backups_nightly\":\"Chaque nuit\",\"stat_backups_manual\":\"Manuel\",\"stat_backups_sub_nightly\":\"S'exécute chaque nuit\",\"stat_backups_sub_manual\":\"Aucune planification\",\"accounts_title\":\"Comptes\",\"accounts_note\":\"Les agents utilisent ces clés sans jamais les voir. Rien d'une clé n'apparaît dans une conversation.\",\"add_account\":\"Ajouter un compte\",\"drive_title\":\"Drive cloud\",\"drive_bar_label\":\"{{size}} stockés, répartis entre les fichiers, la bibliothèque d'artefacts et les sauvegardes\",\"drive_empty_title\":\"Pas encore de drive cloud\",\"drive_empty_body\":\"Créez dans ce compte un bucket privé et chiffré unique pour vos fichiers, la bibliothèque d'artefacts et les sauvegardes.\",\"drive_setup\":\"Configurer le drive cloud\",\"stat_accounts_attention_many\":\"{{count}} demandent votre attention\",\"stat_keys_sub_many\":\"{{count}} clés enregistrées\",\"stat_shares_sub_many\":\"{{count}} liens actifs\",\"drive_bucket_label\":\"Bucket\",\"stat_spend_scope\":\"Facture AWS de ce compte\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "Confirmer l'utilisation d'AWS avant la premiere requete",
				"confirmed_title": "Utilisation d'AWS confirmee",
				"account_changed": "La confirmation portait sur un autre compte AWS ; elle a donc ete retiree. Verifiez le compte ci-dessous et confirmez a nouveau.",
				"service": "Service",
				"region": "Region",
				"credential_source": "Source des identifiants",
				"aws_account": "Compte AWS",
				"provider_default": "(valeur par defaut du fournisseur)",
				"unresolved_account": "n'a pas pu etre resolu",
				"billing_notice": "Ce service AWS est payant. Aucune requete n'est envoyee avant votre confirmation.",
				"confirm_button": "Confirmer et activer",
				"withdraw": "Retirer la confirmation",
				"status_failed": "Impossible de lire l'état de la confirmation.",
				"confirm_failed": "La confirmation n'a pas été enregistrée.",
				"withdraw_failed": "La confirmation n'a pas été retirée.",
				"retry": "Réessayer",
				"badge_confirmed": "Confirmé",
				"badge_not_enabled": "Non activé",
				"confirmed_on": "confirmé le {{date}}",
				"billing_notice_short": "Payant. Rien n'est envoyé avant votre confirmation.",
				"pending_profile_hint": "Termine la saisie du profil AWS pour confirmer.",
				"bedrock_kb_billing_short": "Facturé à chaque recherche : un appel Bedrock Retrieve par Knowledge Base",
				"aws_pricing_link": "Tarifs AWS",
				"withdraw_effect": "Après le retrait, les agents cessent d'utiliser ce service jusqu'à ce que tu confirmes de nouveau."
			},
			"ui": {
				"clear_filter": "Effacer le filtre",
				"no_matches_for": "Aucun résultat pour",
				"no_noun_match": "Aucun(e) {{noun}} correspondant(e)"
			}
		}
	},
	hi: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"क्लाउड खाते, सरल भाषा में। हर उस AWS खाते को देखें जिसे Kiro Crew उपयोग कर सकता है — हर खाते के लिए एक स्वास्थ्य संकेत और उससे मेल खाता पुनः-कनेक्ट मार्गदर्शन, साथ ही S3-आधारित क्लाउड ड्राइव — फ़ाइलें, क्लाउड आर्टिफ़ैक्ट पुस्तकालय और बैकअप — समय-सीमित साझा लिंक के साथ। जब तक स्वयं न कहें तब तक कुछ भी सार्वजनिक नहीं होता, और हर सशुल्क सेवा बिल बनाने से पहले पुष्टि माँगती है।\",\"display_name\":\"AWS Control\",\"highlight_1\":\"हर खाते के लिए एक स्वास्थ्य संकेत, हर एक के साथ प्रोफ़ाइल की प्रमाणीकरण विधि से मेल खाता पुनः-कनेक्ट मार्गदर्शन।\",\"highlight_2\":\"निजी, एन्क्रिप्टेड, संस्करण-सहित भंडारण जो पुष्टि करने के बाद ही बनता है।\",\"highlight_3\":\"क्लाउड आर्टिफ़ैक्ट पुस्तकालय, फ़ाइलें और बैकअप — सब एक ही अपने बकेट पर रहते हैं।\",\"highlight_4\":\"साझा लिंक हमेशा समाप्त होते हैं — जब तक स्वयं न कहें कुछ भी सार्वजनिक नहीं होता।\",\"highlight_5\":\"हर सशुल्क सेवा पहली बार उपयोग से पहले प्रति खाता पुष्टि की जाती है, और हर बदलाव रिकॉर्ड पर रहता है।\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Kiro Crew जिन AWS खातों तक पहुँच सकता है, उनमें से कौन ठीक हैं और इस महीने कितना खर्च हुआ है — यह सब AWS कंसोल खोले बिना देखो।\",\"configuration_1\":\"इस मशीन पर पहले से मौजूद प्रोफ़ाइल से खाता जोड़ो, फिर हर सशुल्क सेवा को पहली बार उपयोग से पहले प्रत्येक खाते के लिए एक बार पुष्ट करो।\"},\"console\":{\"copy\":\"कॉपी करें\",\"copied\":\"कॉपी हो गया\",\"close\":\"बंद करें\",\"loading\":\"लोड हो रहा है…\",\"download\":\"डाउनलोड करें\",\"share\":\"साझा करें\",\"delete\":\"हटाएँ\",\"delete_failed\":\"हटाना विफल रहा — फ़ाइल अपरिवर्तित है। फिर से आज़माएं।\",\"delete_failed_named\":\"“{{name}}” को हटाया नहीं जा सका — फ़ाइल अपरिवर्तित है। फिर कोशिश करें।\",\"download_failed\":\"डाउनलोड शुरू नहीं हो सका। कुछ भी नहीं भेजा गया। फिर से प्रयास करें।\",\"delete_confirm_action\":\"फ़ाइल हटाएं\",\"delete_confirm\":\"“{{name}}” हटाएं? फ़ाइल ड्राइव से हटा दी जाएगी।\",\"col_name\":\"नाम\",\"col_kind\":\"प्रकार\",\"col_size\":\"आकार\",\"col_modified\":\"संशोधित\",\"col_actions\":\"कार्रवाइयाँ\",\"kind_folder\":\"फ़ोल्डर\",\"folder_new\":\"नया फ़ोल्डर\",\"folder_name\":\"फ़ोल्डर का नाम\",\"folder_delete_confirm\":\"“{{name}}” और इसमें मौजूद सब कुछ हटाएँ?\",\"folder_delete_action\":\"फ़ोल्डर हटाएँ\",\"folder_delete_failed\":\"फ़ोल्डर हटाया नहीं जा सका।\",\"folder_create_failed\":\"फ़ोल्डर बनाया नहीं जा सका।\",\"folder_bad_name\":\"इस फ़ोल्डर नाम में ऐसे वर्ण हैं जिन्हें ड्राइव संग्रहित नहीं कर सकती। अक्षर, अंक, स्पेस और . _ - ( ) + @ = सुरक्षित हैं।\",\"folder_deleted_one\":\"“{{name}}” हटाया गया: {{count}} आइटम।\",\"folder_deleted_other\":\"“{{name}}” हटाया गया: {{count}} आइटम।\",\"cancel\":\"रद्द करें\",\"load_more\":\"और लोड करें\",\"stat_this_month\":\"इस माह\",\"storage_consent_needed\":\"इस अकाउंट के लिए क्लाउड स्टोरेज की पुष्टि अभी बाकी है। नीचे पुष्टि करके पेज रीफ़्रेश करो।\",\"stat_stored_value\":\"{{size}} · {{objects}} आइटम\",\"costs_as_of\":\"कैश किए आँकड़े, {{date}} तक के।\",\"costs_consent_missing\":\"इस खाते का खर्च देखने के लिए नीचे लागत रिपोर्टिंग चालू करें।\",\"costs_unavailable\":\"बिल की जानकारी अभी नहीं मिल पाई।\",\"account_unavailable\":\"इस खाते तक अभी पहुँच नहीं हो पा रही। पुनः कनेक्ट करें, फिर वापस आएँ।\",\"drive_status_failed\":\"ड्राइव अभी पढ़ी नहीं जा सकी।\",\"setup_title\":\"क्लाउड ड्राइव सेट करें\",\"setup_body\":\"यह अपने खाते में एक निजी, एन्क्रिप्टेड, संस्करण-सहित भंडारण बकेट बनाता है — फ़ाइलों, आर्टिफ़ैक्ट पुस्तकालय और बैकअप के लिए।\",\"setup_searched_region\":\"{{region}} में कोई ड्राइव नहीं मिली। केवल इसी क्षेत्र में खोजा गया, इसलिए इस खाते के किसी दूसरे क्षेत्र की ड्राइव यहाँ नहीं दिखेगी।\",\"setup_costs_note\":\"लागत उपयोग के अनुसार होती है: जो संग्रहित करें उसका AWS को भुगतान करें, उससे पहले कुछ नहीं।\",\"setup_preview_region\":\"क्षेत्र\",\"setup_preview_resource\":\"संसाधन\",\"setup_preview_btn\":\"पूर्वावलोकन\",\"setup_confirm_btn\":\"इसे बनाएँ\",\"setup_creating\":\"बन रहा है…\",\"setup_error\":\"ड्राइव तैयार नहीं हो सकी। थोड़ी देर बाद फिर कोशिश करें।\",\"setup_confirm_error\":\"ड्राइव नहीं बनाई जा सकी। कुछ नहीं बदला — नीचे दी गई अनुमतियाँ जाँचें और फिर कोशिश करें।\",\"setup_policy_error\":\"पेस्ट करने के लिए अनुमतियाँ लोड नहीं हो सकीं।\",\"setup_policy_label\":\"पेस्ट करने योग्य सटीक अनुमतियाँ दिखाएँ\",\"library_all\":\"सभी\",\"library_not_pushable\":\"छवियाँ अभी क्लाउड में कॉपी नहीं की जा सकतीं।\",\"kind_widget\":\"विजेट\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"टेक्स्ट\",\"kind_webapp\":\"वेब ऐप\",\"kind_image\":\"छवि\",\"drive_title\":\"ड्राइव\",\"drive_upload\":\"अपलोड करें\",\"drive_uploading\":\"अपलोड हो रहा है…\",\"drive_bad_name\":\"उस फ़ाइल नाम में ऐसे अक्षर हैं जिन्हें ड्राइव संग्रहित नहीं कर सकती। अक्षर, अंक, स्पेस और . _ - ( ) + @ = सुरक्षित हैं।\",\"rename_bad_name\":\"उस नाम में ऐसे अक्षर हैं जिन्हें ड्राइव संग्रहित नहीं कर सकती। नाम बदलें और फिर कोशिश करें।\",\"drive_bad_name_named\":\"“{{name}}” अपलोड नहीं हो सकती — नाम में ऐसे अक्षर हैं जिन्हें ड्राइव संग्रहित नहीं कर सकती। अक्षर, अंक, स्पेस और . _ - ( ) + @ = सुरक्षित हैं।\",\"drive_upload_failed\":\"“{{name}}” अपलोड नहीं हो सकी। फिर कोशिश करें।\",\"section_files\":\"फ़ाइलें\",\"section_library\":\"आर्टिफ़ैक्ट लाइब्रेरी\",\"section_backup\":\"बैकअप\",\"share_title\":\"“{{name}}” साझा करें\",\"share_expiry\":\"लिंक इतने समय बाद समाप्त होता है\",\"share_note\":\"टिप्पणी\",\"share_note_placeholder\":\"यह लिंक किसलिए है?\",\"share_create\":\"लिंक बनाएँ\",\"share_creating\":\"बन रहा है…\",\"share_failed\":\"साझा लिंक नहीं बन सका। कुछ भी साझा नहीं हुआ।\",\"expiry_1h\":\"1 घंटा\",\"expiry_1d\":\"1 दिन\",\"expiry_7d\":\"7 दिन\",\"share_expires_note\":\"समाप्त होने पर लिंक काम करना बंद कर देता है, और इसे पहले वापस नहीं लिया जा सकता।\",\"share_credentials_caveat\":\"यदि खाते का साइन-इन सत्र पहले समाप्त हो जाए तो यह जल्दी भी बंद हो सकता है।\",\"cli_drawer_label\":\"यह कहाँ रहता है\",\"cli_drawer_hint\":\"ये फ़ाइलें बकेट {{bucket}} में {{prefix}} के अंतर्गत रहती हैं। यह कमांड इन्हें ऐसे टर्मिनल से सूचीबद्ध करता है जिसके पास इस खाते की क्रेडेंशियल हों।\",\"backup_title\":\"बैकअप\",\"backup_kind_snapshot\":\"स्मृति व कार्यक्षेत्र\",\"backup_kind_sessions\":\"सत्र संग्रह\",\"backup_last_run\":\"अंतिम बैकअप {{when}} · {{size}}\",\"backup_never\":\"अभी तक बैकअप नहीं हुआ\",\"backup_never_recorded\":\"यहाँ कोई रन दर्ज नहीं है — पुराने आर्काइव अब भी ड्राइव पर हो सकते हैं\",\"backup_remembered\":\"इस इंस्टॉल के दर्ज किए गए संग्रह: {{count}} · सूची देखो\",\"backup_sessions_scope\":\"इस Kiro होम के अंतर्गत हर सत्र के CLI रीप्ले लॉग शामिल हैं, केवल {{productName}} में शुरू की गई चैट के नहीं।\",\"backup_run_now\":\"अभी बैकअप करें\",\"backup_running\":\"बैकअप हो रहा है…\",\"backup_failed\":\"पिछला बैकअप विफल रहा: {{reason}}\",\"backup_start_failed\":\"बैकअप शुरू नहीं हो सका।\",\"backup_start_retry\":\"बैकअप शुरू नहीं हो सका। फिर से प्रयास करें।\",\"backup_start_unavailable\":\"इस ऐप के लिए बैकअप उपलब्ध नहीं है। जाँचें कि जॉब रनटाइम पंजीकृत है।\",\"backup_start_consent\":\"इस खाते के लिए S3 पहुँच दें, फिर बैकअप शुरू करें।\",\"backup_start_no_drive\":\"इस खाते में अभी कोई ड्राइव नहीं है। एक बनाएँ, फिर बैकअप शुरू करें।\",\"backup_nightly\":\"हर रात बैकअप करें\",\"backup_nightly_hint\":\"दिन में एक बार स्मृति व कार्यक्षेत्र का स्नैपशॉट चलाता है।\",\"backup_nightly_blocked_other_account\":\"रात्रि स्नैपशॉट केवल डिफ़ॉल्ट खाते के लिए चलते हैं, इसलिए इस खाते का कुछ भी बैकअप नहीं होता।\",\"backup_nightly_sessions\":\"हर रात सेशन का बैकअप लें\",\"backup_nightly_sessions_hint\":\"दिन में एक बार इस खाते की ड्राइव पर सेशन संग्रह अपलोड करता है। इसमें बातचीत जैसी है वैसी रहती है, कुछ भी हटाया नहीं जाता।\",\"backup_nightly_sessions_destination\":\"वह ड्राइव इस AWS खाते में S3 स्टोरेज है, और {{button}} संग्रह को उसी जगह भेजता है।\",\"backup_nightly_sessions_blocked_host\":\"यह कंप्यूटर सेशन संग्रह नहीं बना सकता, इसलिए कुछ भी अपलोड नहीं होता।\",\"backup_nightly_sessions_blocked_redaction\":\"बाहर जाने वाले डेटा की छँटाई चालू है और सेशन संग्रह में यह अभी संभव नहीं है, इसलिए कुछ भी अपलोड नहीं होता।\",\"backup_nightly_sessions_blocked_other_account\":\"रात्रि अपलोड केवल डिफ़ॉल्ट खाते के लिए चलते हैं, इसलिए इस खाते के लिए कुछ भी अपलोड नहीं होता।\",\"backup_nightly_sessions_blocked_other\":\"इस कंप्यूटर पर रात्रि अपलोड रुके हुए हैं, इसलिए कुछ भी अपलोड नहीं होता।\",\"backup_nightly_sessions_blocked_next\":\"तुम बैकअप खुद शुरू कर सकते हो।\",\"backup_nightly_sessions_blocked_next_redaction\":\"तुम बैकअप खुद शुरू कर सकते हो, लेकिन सेशन संग्रह बिना छँटाई अपलोड होता है।\",\"backup_archive\":\"संग्रहित बैकअप\",\"backup_restore\":\"पुनर्स्थापित करें\",\"backup_show_all_archives\":\"सब दिखाएँ ({{count}})\",\"backup_restore_caveat\":\"पुनर्स्थापना के लिए बैकअप फ़ोल्डर पर पढ़ने की अनुमति आवश्यक है। अनुशंसित न्यूनतम-विशेषाधिकार नीति जानबूझकर केवल लिखने की अनुमति देती है, इसलिए जब तक खाते के क्रेडेंशियल अधिक व्यापक न हों, इसे अस्वीकार कर दिया जाएगा।\",\"backup_remote_error\":\"संग्रहित बैकअप अभी पढ़े नहीं जा सके।\",\"backup_status_failed\":\"बैकअप की स्थिति पढ़ी नहीं जा सकी।\",\"backup_nightly_failed\":\"“{{setting}}” में बदलाव नहीं हो सका। यह अपरिवर्तित है।\",\"backup_restore_failed\":\"वह बैकअप पुनर्स्थापित नहीं हो सका। कुछ भी नहीं लिखा गया।\",\"backup_restored_note\":\"मौजूदा डेटा बदला नहीं गया। बैकअप नीचे दिए पथ पर एक स्टेजिंग फ़ोल्डर में डाउनलोड किया गया।\",\"backup_restore_recovered_note\":\"इसी इंस्टॉलेशन का अपना अपलोड डाउनलोड किया गया और उसके रिकॉर्ड से मिलाकर जाँचा गया। ड्राइव पर इसे किसी और चीज़ ने ओवरराइट कर दिया था, और वह तुम्हारे अगले अपलोड के साथ भी ऐसा कर सकती है। शुरुआत उन दूसरे इंस्टॉलेशन से करो जिन्हें यह पेज इसी ड्राइव पर बैकअप करते हुए दिखाता है।\",\"backup_install\":\"यह इंस्टॉलेशन\",\"backup_install_hint\":\"हर इंस्टॉलेशन अपने बैकअप अपने ही नाम से रखता है, ताकि रिस्टोर करते समय इस इंस्टॉलेशन के आर्काइव को दूसरी इंस्टॉलेशन के आर्काइव से अलग पहचाना जा सके।\",\"backup_install_rename\":\"नाम बदलो\",\"backup_install_save\":\"नाम सहेजो\",\"backup_install_rename_failed\":\"इंस्टॉलेशन का नाम सहेजा नहीं जा सका। यह अपरिवर्तित है।\",\"backup_install_name_label\":\"इंस्टॉलेशन का नाम\",\"backup_attribution_self\":\"{{label}} · यह इंस्टॉलेशन\",\"backup_attribution_self_unnamed\":\"यह इंस्टॉलेशन\",\"backup_attribution_other\":\"\\\"{{label}}\\\" (एक और इंस्टॉलेशन · {{id}})\",\"backup_attribution_other_unnamed\":\"एक और इंस्टॉलेशन · {{id}}\",\"backup_attribution_unverified\":\"असत्यापित उत्पत्ति\",\"backup_origin_unknown\":\"अज्ञात मूल\",\"backup_none_from_this_install\":\"इस इंस्टॉलेशन से कोई बैकअप नहीं। अन्य इंस्टॉलेशन के आर्काइव देखने के लिए उन्हें शामिल करो।\",\"backup_others_on_drive\":\"इस ड्राइव पर बैकअप लेने वाले अन्य इंस्टॉलेशन: {{count}}\",\"backup_show_others\":\"अन्य इंस्टॉलेशन के आर्काइव शामिल करो\",\"backup_others_truncated\":\"केवल पहले {{max}} अन्य इंस्टॉलेशन दिखाए गए हैं।\",\"backup_archives_truncated\":\"{{kind}} के कुछ संग्रह सूची में नहीं आ सके। सबसे नए यहाँ शायद न दिखें।\",\"backup_shared_note\":\"दो इंस्टॉलेशन द्वारा साझा की गई एक ड्राइव का मतलब साझा मेमोरी या साझा सेशन नहीं है। हर बैकअप एक पल का अलग आर्काइव है, और रिस्टोर उस फ़ाइल को केवल एक स्टेजिंग फ़ोल्डर में डाउनलोड करता है — फ़ाइलें तुम ख़ुद बदलते हो, gateway बंद होने पर।\",\"backup_restore_foreign_confirm\":\"यह आर्काइव किसी और इंस्टॉलेशन ({{install}}) ने अपलोड किया था। इसे रिस्टोर करने पर उस इंस्टॉलेशन का डेटा डाउनलोड होगा, इस इंस्टॉलेशन का नहीं। फिर भी डाउनलोड करें?\",\"backup_restore_unverified_confirm\":\"यह आर्काइव इसी इंस्टॉलेशन के अपने फ़ोल्डर में रखा है, पर इस इंस्टॉलेशन के पास इसे अपलोड करने का कोई रिकॉर्ड नहीं है। ड्राइव पर लिख सकने वाला कोई भी वह फ़ोल्डर बना सकता है, इसलिए हो सकता है यह इस इंस्टॉलेशन का न हो। फिर भी डाउनलोड करें?\",\"backup_restore_unknown_confirm\":\"यह आर्काइव इंस्टॉलेशन को नाम मिलने से पहले अपलोड हुआ था, इसलिए यह अज्ञात है कि इसे किस इंस्टॉलेशन ने लिखा। फिर भी डाउनलोड करें?\",\"backup_restore_overwritten_confirm\":\"यह आर्काइव इसी इंस्टॉलेशन ने अपलोड किया था, पर ड्राइव पर अब वह नहीं है जो इसने अपलोड किया था — बाद में किसी और चीज़ ने उसे ओवरराइट कर दिया है। फिर भी डाउनलोड करें?\",\"backup_restore_overwritten_refused\":\"यह आर्काइव इसी इंस्टॉलेशन ने अपलोड किया था, पर ड्राइव पर अब वह नहीं है जो इसने अपलोड किया था। फिर भी डाउनलोड करने के लिए संग्रहित बैकअप खोलो और डाउनलोड करो चुनो।\",\"backup_restore_foreign_refused\":\"वह आर्काइव किसी और इंस्टॉलेशन का है। फिर भी डाउनलोड करने के लिए रिस्टोर की पुष्टि करो।\",\"backup_restore_confirm_yes\":\"डाउनलोड करो\",\"backup_restore_confirm_no\":\"रद्द करो\",\"access_title\":\"साझा लिंक\",\"access_empty\":\"कोई सक्रिय साझा लिंक नहीं।\",\"access_expires_in\":\"{{when}} समाप्त होता है\",\"access_forget\":\"सूची से हटाएं\",\"access_object_missing\":\"फ़ाइल हटाई गई\",\"access_unchecked\":\"इन लिंक की ड्राइव से जाँच नहीं हुई, इसलिए हटाई गई फ़ाइल यहाँ चिह्नित नहीं होती।\",\"access_footer\":\"सूची से लिंक हटाने से वह रद्द नहीं होता — साझा किया गया लिंक समाप्ति तक काम करता रहता है।\",\"access_list_failed\":\"साझा लिंक पढ़े नहीं जा सके।\",\"access_forget_failed\":\"वह लिंक सूची से हटाया नहीं जा सका। यह अभी भी सूची में है।\",\"keys_count_one\":\"{{count}} कुंजी\",\"keys_count_other\":\"{{count}} कुंजियाँ\",\"keys_for_account\":\"{{name}} की कुंजियाँ\",\"key_healthy\":\"ठीक\",\"parent_folders\":\"मूल फ़ोल्डर\",\"folder_actions\":\"फ़ोल्डर कार्रवाइयाँ\",\"file_actions\":\"फ़ाइल कार्रवाइयाँ\",\"root_storage_used\":\"स्टोरेज किसमें जा रहा है\",\"root_section_objects_one\":\"{{objects}} आईटम\",\"root_section_objects_other\":\"{{objects}} आईटम\",\"view_grid\":\"ग्रिड दृश्य\",\"view_list\":\"सूची दृश्य\",\"library_add\":\"आर्टिफ़ैक्ट से जोड़ें\",\"library_add_one\":\"आर्टिफ़ैक्ट लाइब्रेरी में जोड़ें\",\"folder_open\":\"फोल्डर {{name}} खोलें\",\"library_adding\":\"जोड़ा जा रहा है…\",\"library_add_oneway\":\"यहाँ की प्रतियाँ क्लाउड स्टोरेज लेती हैं।\",\"library_add_again\":\"फिर से जोड़ें\",\"library_add_count\":\"आर्टिफ़ैक्ट से जोड़ें ({{count}} तैयार)\",\"library_add_nothing\":\"जोड़ने के लिए और कुछ नहीं - जो जोड़ा जा सकता था वह यहाँ है।\",\"library_list_failed\":\"क्लाउड की सामग्री नहीं पढ़ी जा सकी।\",\"files_list_failed\":\"यह फ़ोल्डर पढ़ा नहीं जा सका।\",\"library_local_failed\":\"आर्टिफ़ैक्ट पढ़े नहीं जा सके।\",\"retry\":\"फिर कोशिश करें\",\"library_add_none\":\"कोई आर्टिफ़ैक्ट मेल नहीं खाता।\",\"library_update\":\"प्रति अपडेट करें\",\"library_search\":\"अपने आर्टिफ़ैक्ट खोजें\",\"library_push_failed\":\"यह आर्टिफ़ैक्ट जोड़ा नहीं जा सका। फिर से कोशिश करें।\",\"library_blurb\":\"Kiro द्वारा बनाई गई चीज़ें, क्लाउड में कॉपी की गई। स्वयं अपलोड की गई फ़ाइलें “फ़ाइलें” में रहती हैं।\",\"library_empty_title\":\"अभी तक क्लाउड में कुछ भी कॉपी नहीं हुआ\",\"library_empty_body\":\"इस फ़ोल्डर में Kiro द्वारा बनाई गई चीज़ें—विजेट, पेज, दस्तावेज़—तब रहती हैं, जब उन्हें क्लाउड में कॉपी किया जाता है। कंप्यूटर से अपलोड की गई फ़ाइलें इसके बजाय “फ़ाइलें” में रखें।\",\"library_cloud_only\":\"केवल क्लाउड में\",\"library_in_cloud\":\"क्लाउड में\",\"library_stale_preview\":\"क्लाउड में v{{version}} है; प्रीव्यू में नई स्थानीय प्रति दिख रही है\",\"library_stale_list\":\"क्लाउड प्रति v{{version}} है; स्थानीय प्रति नई है\",\"library_added\":\"{{when}} जोड़ा गया\",\"library_open\":\"आर्टिफ़ैक्ट में {{name}} खोलें\",\"files_empty_title\":\"“फ़ाइलें” खाली है\",\"files_empty_body\":\"इस फ़ोल्डर में कंप्यूटर से अपलोड की गई फ़ाइलें रहती हैं। यह आर्टिफ़ैक्ट लाइब्रेरी से अलग है, जिसमें Kiro द्वारा बनाई गई चीज़ें रहती हैं।\",\"library_remove\":\"हटाएँ\",\"library_remove_confirm\":\"“{{name}}” को क्लाउड लाइब्रेरी से हटाएँ?\",\"library_remove_confirm_slug\":\"यह क्लाउड फ़ोल्डर <folder>{{folder}}</folder> खाली करता है।\",\"library_actions\":\"लाइब्रेरी आइटम क्रियाएँ\",\"library_remove_action\":\"प्रतिलिपि हटाएँ\",\"library_removing\":\"हटाया जा रहा है…\",\"library_remove_failed\":\"हटाना विफल रहा — क्लाउड प्रतिलिपि अपरिवर्तित है। फिर से आज़माएं।\",\"move_conflict\":\"गंतव्य फ़ोल्डर में इसी नाम की फ़ाइल पहले से मौजूद है। कोई दूसरा फ़ोल्डर चुनो, या पहले फ़ाइल का नाम बदलो।\",\"move_shared\":\"इस फ़ाइल का एक सक्रिय शेयर लिंक है — इसे स्थानांतरित करने से लिंक टूट जाएगा। शेयर हटाएं (या उसे समाप्त होने दें) और फिर कोशिश करें।\",\"rename\":\"नाम बदलें\",\"preview_truncated\":\"बड़ी फ़ाइल — केवल शुरुआत दिखाई जा रही है।\",\"preview_redacted\":\"इस पूर्वावलोकन में संवेदनशील मान छिपाए गए हैं।\",\"preview_unsupported\":\"इस प्रकार की फ़ाइल का पूर्वावलोकन नहीं हो सकता। देखने के लिए डाउनलोड करें।\",\"preview_failed\":\"पूर्वावलोकन लोड नहीं हुआ। देखने के लिए फ़ाइल डाउनलोड करें, या फिर कोशिश करें।\",\"search_files\":\"फ़ाइल नाम या पथ से खोजें…\",\"search_clear\":\"खोज साफ़ करें\",\"search_pending\":\"खोज रहे हैं…\",\"search_capped\":\"बहुत अधिक मिलान — केवल पहले {{count}} दिखाए जा रहे हैं।\",\"search_failed\":\"खोज विफल रही। फिर कोशिश करें।\",\"search_goto\":\"मूल फ़ोल्डर खोलें\",\"move_failed\":\"फ़ाइल स्थानांतरित नहीं हो सकी। फिर से प्रयास करें।\",\"rename_conflict\":\"इस नाम की फ़ाइल यहाँ पहले से मौजूद है।\",\"rename_shared\":\"इस फ़ाइल का एक सक्रिय साझा लिंक है — नाम बदलने से लिंक टूट जाएगा। साझाकरण हटाएँ (या उसे समाप्त होने दें) और फिर से कोशिश करें।\",\"rename_failed\":\"फ़ाइल का नाम नहीं बदला जा सका। फिर से कोशिश करें।\",\"rename_failed_named\":\"“{{name}}” का नाम नहीं बदला जा सका: {{reason}}\",\"library_add_empty\":\"अभी कोई आर्टिफ़ैक्ट नहीं है। Kiro तुम्हारे लिए जो बनाएगा वह यहाँ दिखेगा, क्लाउड में कॉपी करने के लिए तैयार।\",\"move_to\":\"फ़ोल्डर में स्थानांतरित करें…\",\"move_title\":\"“{{name}}” को यहाँ स्थानांतरित करें\",\"move_root\":\"फ़ाइलें (शीर्ष स्तर)\",\"move_up\":\"ऊपर {{name}} में\",\"move_no_folders\":\"यहाँ स्थानांतरित करने के लिए कोई और फ़ोल्डर नहीं है। पहले एक बनाएँ।\",\"move_moving\":\"स्थानांतरित हो रहा है…\",\"move_moving_picker\":\"स्थानांतरित हो रहा है… इसे बंद करने से स्थानांतरण रद्द नहीं होगा।\",\"move_to_busy\":\"एक और स्थानांतरण अभी चल रहा है\",\"move_ask_agent\":\"इस स्थानांतरण के बारे में एजेंट से पूछें\",\"stat_storage\":\"स्टोरेज\",\"stat_objects\":\"ऑब्जेक्ट\",\"key_needs_attention\":\"ध्यान चाहिए\",\"backup_state_current\":\"बैकअप हो गया\",\"backup_state_never\":\"कभी नहीं चला\",\"costs_refresh_failed\":\"बिल की ताज़ा रीडिंग विफल रही; यह कैश किया गया आँकड़ा है।\"},\"page\":{\"refresh\":\"रीफ़्रेश करें\",\"health_ok\":\"स्वस्थ\",\"health_degraded\":\"ध्यान देने की ज़रूरत\",\"health_unknown\":\"अज्ञात\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"क्रेडेंशियल प्रोसेस\",\"kind_other\":\"अन्य\",\"default_profile\":\"डिफ़ॉल्ट प्रोफ़ाइल\",\"not_connected_yet\":\"अभी कनेक्ट नहीं है\",\"reconnect\":\"फिर से कनेक्ट करें\",\"reconnect_loading\":\"फिर से कनेक्ट करने का मार्गदर्शन लोड हो रहा है…\",\"reconnect_error\":\"फिर से कनेक्ट करने का मार्गदर्शन लोड नहीं हो सका।\",\"reconnect_hint_sso\":\"इस कनेक्शन को नवीनीकृत करने के लिए फिर से साइन इन करें, फिर इस पेज को रीफ़्रेश करें।\",\"reconnect_hint_credential_process\":\"क्रेडेंशियल नवीनीकृत करने के लिए अपने टर्मिनल में यह कमांड चलाएँ, फिर इस पेज को रीफ़्रेश करें।\",\"reconnect_hint_other\":\"कनेक्शन बहाल करने के लिए अपने टर्मिनल में यह कमांड चलाएँ, फिर इस पेज को रीफ़्रेश करें।\",\"copy\":\"कॉपी करें\",\"copied\":\"कॉपी हो गया\",\"empty_title\":\"अभी कोई अकाउंट नहीं\",\"empty_body\":\"नीचे खाते जोड़ें में इस मशीन का कोई AWS प्रोफ़ाइल रजिस्टर करें, और उसका अकाउंट यहाँ दिखेगा।\",\"error_title\":\"तुम्हारे अकाउंट लोड नहीं हो सके।\",\"error_body\":\"अकाउंट सूची पढ़ते समय कुछ गड़बड़ हो गई। कुछ ही देर में फिर से प्रयास करें।\",\"error_forbidden_body\":\"यह डैशबोर्ड सत्र स्वामी का नहीं है, इसलिए यह AWS अकाउंट प्रबंधित नहीं कर सकता। स्वामी के रूप में साइन इन करें, फिर पुनः प्रयास करें।\",\"retry\":\"फिर से प्रयास करें\",\"disabled_title\":\"AWS Control बंद है\",\"disabled_body\":\"अपने अकाउंट देखने के लिए App Store से इस ऐप को चालू करें।\",\"aggregate_accounts_one\":\"{{count}} खाता\",\"aggregate_accounts_other\":\"{{count}} खाते\",\"aggregate_keys_one\":\"{{count}} कुंजी\",\"aggregate_keys_other\":\"{{count}} कुंजियाँ\",\"aggregate_healthy_one\":\"{{count}} ठीक\",\"aggregate_healthy_other\":\"{{count}} ठीक\",\"keys_summary_one\":\"{{count}} कुंजी\",\"keys_summary_other\":\"{{count}} कुंजियाँ\",\"add_accounts_title\":\"खाते जोड़ें\",\"add_accounts_summary\":\"इस मशीन के और AWS प्रोफ़ाइल पंजीकृत करें\",\"add_accounts_intro\":\"ये स्थानीय AWS प्रोफ़ाइल अभी पंजीकृत नहीं हैं। जो भी जोड़ोगे वह उसके अकाउंट के अंतर्गत एक कुंजी बन जाएगी।\",\"add_accounts_search_placeholder\":\"प्रोफ़ाइल खोजो\",\"add_accounts_search_keeps_selected\":\"तुमने जो प्रोफ़ाइल चुनी हैं, वे मेल न खाने पर फी सूची में बनी रहती हैं।\",\"add_accounts_none\":\"सभी स्थानीय प्रोफ़ाइल पहले से पंजीकृत हैं।\",\"add_accounts_no_profiles\":\"इस मशीन पर अभी कोई AWS प्रोफ़ाइल नहीं है। पहले एक बनाओ (उदाहरण के लिए, टर्मिनल में aws configure चलाओ), फिर उसे यहाँ पंजीकृत करो।\",\"add_accounts_unsupported\":\"Windows पर AWS Control इस मशीन के AWS प्रोफ़ाइल तक नहीं पहुँच सकता: AWS ऐक्सेस के लिए Linux या macOS शेल चाहिए। {{productName}} गेटवे को WSL (Windows Subsystem for Linux) में चलाएँ, फिर वहाँ सेट किए प्रोफ़ाइल रजिस्टर करें।\",\"add_accounts_count_one\":\"{{max}} में से {{count}} पंजीकृत\",\"add_accounts_count_other\":\"{{max}} में से {{count}} पंजीकृत\",\"add_accounts_cap_reached\":\"{{max}} कुंजियों की सीमा पूरी हो गई है। और जोड़ने से पहले एक हटाएँ।\",\"add_accounts_register\":\"चयनित पंजीकृत करें\",\"add_accounts_registering\":\"पंजीकृत किया जा रहा है…\",\"add_accounts_error\":\"उन प्रोफ़ाइल को पंजीकृत नहीं किया जा सका। कुछ भी नहीं जोड़ा गया। फिर से प्रयास करें।\",\"add_accounts_load_error\":\"स्थानीय AWS प्रोफ़ाइल सूचीबद्ध नहीं हो सकीं।\",\"search_placeholder\":\"खाते खोजो\",\"paid_services_title\":\"सशुल्क सेवाएँ\",\"orphan_consent\":\"यहाँ पंजीकृत नहीं किए गए AWS खाते के लिए पुष्टि की गई है। नीचे पुष्टि वापस लें, या उस खाते को फिर से पंजीकृत करके उसके पेज से प्रबंधित करें।\",\"account_actions\":\"खाता क्रियाएँ\",\"remove_account\":\"AWS Control से हटाएँ…\",\"remove_account_action\":\"हटाएँ\",\"remove_account_confirm\":\"“{{name}}” को AWS Control से हटाएँ? AWS में या तुम्हारे AWS CLI कॉन्फ़िगरेशन में कुछ नहीं बदलता।\",\"remove_account_error\":\"खाता हटाया नहीं जा सका।\",\"remove_account_hint\":\"AWS में कुछ नहीं बदलता\",\"forget_key_confirm\":\"इस पंक्ति की कुंजी “{{name}}” भुला दें? AWS में या तुम्हारे AWS CLI कॉन्फ़िगरेशन में कुछ नहीं बदलता।\",\"forget_key_action\":\"कुंजी भुलाएँ\",\"totals_summary_one\":\"{{accounts}} खाता · {{keys}}\",\"totals_summary_other\":\"{{accounts}} खाते · {{keys}}\",\"keys_healthy_one\":\"स्वस्थ कुंजियाँ: {{healthy}}/{{n}}\",\"keys_healthy_other\":\"स्वस्थ कुंजियाँ: {{healthy}}/{{n}}\"},\"rail\":{\"accounts\":\"खाते और क्रेडेंशियल\",\"nav\":\"AWS Control अनुभाग\",\"switch_account\":\"खाता बदलें\",\"usage\":\"उपयोग और लागत\",\"use_account\":\"इस खाते का उपयोग करें\"},\"overview\":{\"title\":\"अवलोकन\",\"subtitle\":\"तुम्हारे एजेंट जिन खातों, कुंजियों, क्लाउड ड्राइव और सशुल्क सेवाओं को छू सकते हैं, उन सबके लिए एक कमरा।\",\"stat_accounts\":\"खाते\",\"stat_accounts_attention_one\":\"{{count}} खाते को ध्यान चाहिए\",\"stat_accounts_attention_other\":\"{{count}} खातों को ध्यान चाहिए\",\"stat_accounts_all_ok\":\"सब ठीक है\",\"stat_keys\":\"कुंजियाँ ठीक\",\"stat_keys_sub_one\":\"{{count}} कुंजी दर्ज\",\"stat_keys_sub_other\":\"{{count}} कुंजियाँ दर्ज\",\"stat_drive\":\"ड्राइव इस्तेमाल\",\"stat_drive_none\":\"कोई ड्राइव नहीं\",\"stat_spend\":\"इस महीने अब तक\",\"stat_spend_consent\":\"लागत रिपोर्ट बंद है\",\"stat_shares_none\":\"कुछ साझा नहीं\",\"stat_shares_sub_one\":\"{{count}} सक्रिय लिंक\",\"stat_shares_sub_other\":\"{{count}} सक्रिय लिंक\",\"stat_backups_nightly\":\"हर रात\",\"stat_backups_manual\":\"मैनुअल\",\"stat_backups_sub_nightly\":\"हर रात चलता है\",\"stat_backups_sub_manual\":\"कोई शेड्यूल नहीं\",\"accounts_title\":\"खाते\",\"accounts_note\":\"एजेंट इन कुंजियों का इस्तेमाल करते हैं लेकिन उन्हें कभी देखते नहीं; कुंजी का कोई हिस्सा चैट में नहीं आता।\",\"add_account\":\"खाता जोड़ो\",\"drive_title\":\"क्लाउड ड्राइव\",\"drive_bar_label\":\"{{size}} रखा है: फ़ाइलें, आर्टिफ़ैक्ट लाइब्रेरी और बैकअप\",\"drive_empty_title\":\"अभी क्लाउड ड्राइव नहीं\",\"drive_empty_body\":\"इस खाते में अपनी फ़ाइलों, आर्टिफ़ैक्ट लाइब्रेरी और बैकअप के लिए एक निजी, एन्क्रिप्टेड बकेट बनाओ।\",\"drive_setup\":\"क्लाउड ड्राइव सेट करो\",\"drive_bucket_label\":\"बकेट\",\"stat_spend_scope\":\"इस खाते का AWS बिल\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "पहले अनुरोध से पहले AWS उपयोग की पुष्टि करें",
				"confirmed_title": "AWS उपयोग की पुष्टि हो गई",
				"account_changed": "यह किसी दूसरे AWS खाते के लिए पुष्ट किया गया था, इसलिए पुष्टि वापस ले ली गई। नीचे दिया खाता देखें और फिर पुष्टि करें।",
				"service": "सेवा",
				"region": "क्षेत्र",
				"credential_source": "क्रेडेंशियल स्रोत",
				"aws_account": "AWS खाता",
				"provider_default": "(प्रदाता का डिफ़ॉल्ट)",
				"unresolved_account": "हल नहीं किया जा सका",
				"billing_notice": "यह एक सशुल्क AWS सेवा है। पुष्टि होने तक कोई अनुरोध नहीं भेजा जाता।",
				"confirm_button": "पुष्टि करें और चालू करें",
				"withdraw": "पुष्टि वापस लें",
				"status_failed": "पुष्टि की स्थिति पढ़ी नहीं जा सकी।",
				"confirm_failed": "पुष्टि दर्ज नहीं हुई।",
				"withdraw_failed": "पुष्टि वापस नहीं ली गई।",
				"retry": "फिर कोशिश करें",
				"badge_confirmed": "पुष्ट",
				"badge_not_enabled": "चालू नहीं",
				"confirmed_on": "{{date}} को पुष्ट",
				"billing_notice_short": "शुल्क लगेगा। तुम्हारी पुष्टि तक कुछ नहीं भेजा जाता।",
				"pending_profile_hint": "पुष्टि करने के लिए AWS प्रोफ़ाइल भरना पूरा करो।",
				"bedrock_kb_billing_short": "हर सर्च पर बिल: हर Knowledge Base के लिए एक Bedrock Retrieve कॉल",
				"aws_pricing_link": "AWS मूल्य",
				"withdraw_effect": "वापस लेने पर एजेंट इस सेवा का इस्तेमाल तब तक बंद कर देंगे जब तक तुम दोबारा पुष्टि नहीं करते।"
			},
			"ui": {
				"clear_filter": "फ़िल्टर साफ़ करें",
				"no_matches_for": "कोई मिलान नहीं",
				"no_noun_match": "कोई {{noun}} मेल नहीं"
			}
		}
	},
	it: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"I tuoi account cloud, in parole semplici. Vedi ogni account AWS che Kiro Crew può usare, con una spia di stato per account e indicazioni di riconnessione su misura, oltre a un drive cloud basato su S3 — file, una libreria di artefatti cloud e backup — con link di condivisione a tempo. Nulla è pubblico se non lo decidi tu, e ogni servizio a pagamento chiede la tua conferma prima di poterti addebitare qualcosa.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"Una spia di stato per account, ciascuna con indicazioni di riconnessione adatte al modo in cui il profilo si autentica\",\"highlight_2\":\"Spazio di archiviazione privato, cifrato e con versioni, creato solo dopo la tua conferma\",\"highlight_3\":\"La tua libreria di artefatti cloud, i file e i backup risiedono tutti su un unico bucket di tua proprietà\",\"highlight_4\":\"I link di condivisione scadono sempre — nulla è pubblico se non lo decidi tu\",\"highlight_5\":\"Ogni servizio a pagamento è confermato per account prima del primo utilizzo, e ogni modifica è registrata\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Guarda ogni account AWS che Kiro Crew può raggiungere, quali sono in salute e quanto ti sta costando questo mese, senza aprire la console AWS.\",\"configuration_1\":\"Aggiungi un account dai profili già presenti su questa macchina, poi conferma ogni servizio a pagamento una volta per account prima del primo utilizzo.\"},\"console\":{\"copy\":\"Copia\",\"copied\":\"Copiato\",\"close\":\"Chiudi\",\"loading\":\"Caricamento…\",\"download\":\"Scarica\",\"share\":\"Condividi\",\"delete\":\"Elimina\",\"delete_failed\":\"Eliminazione non riuscita: il file è invariato. Riprova.\",\"delete_failed_named\":\"Impossibile eliminare “{{name}}”: il file è rimasto invariato. Riprova.\",\"download_failed\":\"Non è stato possibile avviare il download. Non è stato inviato nulla. Riprova.\",\"delete_confirm_action\":\"Elimina file\",\"delete_confirm\":\"Eliminare «{{name}}»? Il file viene rimosso dal drive.\",\"col_name\":\"Nome\",\"col_kind\":\"Tipo\",\"col_size\":\"Dimensione\",\"col_modified\":\"Modificato\",\"col_actions\":\"Azioni\",\"kind_folder\":\"Cartella\",\"folder_new\":\"Nuova cartella\",\"folder_name\":\"Nome della cartella\",\"folder_delete_confirm\":\"Eliminare «{{name}}» e tutto il suo contenuto?\",\"folder_delete_action\":\"Elimina cartella\",\"folder_delete_failed\":\"Impossibile eliminare la cartella.\",\"folder_create_failed\":\"Impossibile creare la cartella.\",\"folder_bad_name\":\"Questo nome di cartella contiene caratteri che il drive non può archiviare. Lettere, cifre, spazi e . _ - ( ) + @ = sono sicuri.\",\"folder_deleted_one\":\"Eliminata «{{name}}»: {{count}} elemento.\",\"folder_deleted_other\":\"Eliminata «{{name}}»: {{count}} elementi.\",\"folder_deleted_many\":\"Eliminata «{{name}}»: {{count}} elementi.\",\"cancel\":\"Annulla\",\"load_more\":\"Carica altro\",\"stat_this_month\":\"Questo mese\",\"storage_consent_needed\":\"L'archiviazione cloud di questo account non è ancora confermata. Confermala qui sotto e poi aggiorna la pagina.\",\"stat_stored_value\":\"{{size}} · {{objects}} elementi\",\"costs_as_of\":\"Dati in cache, aggiornati al {{date}}.\",\"costs_consent_missing\":\"Attiva il report dei costi qui sotto per vedere le spese di questo account.\",\"costs_unavailable\":\"Al momento non è stato possibile leggere la fattura.\",\"account_unavailable\":\"Al momento non è possibile raggiungere questo account. Riconnettilo e poi torna qui.\",\"drive_status_failed\":\"Al momento non è stato possibile leggere il drive.\",\"setup_title\":\"Configura un drive cloud\",\"setup_body\":\"Questa operazione crea un unico bucket di archiviazione privato, cifrato e con versioni nel tuo account, per i tuoi file, la libreria di artefatti e i backup.\",\"setup_searched_region\":\"Nessun drive trovato in {{region}}. È stata cercata solo questa regione, quindi un drive in un’altra regione di questo account non apparirà qui.\",\"setup_costs_note\":\"I costi seguono l'uso: paghi AWS per ciò che archivi, e nulla prima di allora.\",\"setup_preview_region\":\"Regione\",\"setup_preview_resource\":\"Risorsa\",\"setup_preview_btn\":\"Anteprima\",\"setup_confirm_btn\":\"Crea\",\"setup_creating\":\"Creazione…\",\"setup_error\":\"Impossibile preparare il drive. Riprova tra un momento.\",\"setup_confirm_error\":\"Impossibile creare il drive. Nulla è stato modificato: controlla le autorizzazioni qui sotto e riprova.\",\"setup_policy_error\":\"Impossibile caricare le autorizzazioni da incollare.\",\"setup_policy_label\":\"Mostra i permessi esatti da incollare\",\"library_all\":\"Tutti\",\"library_not_pushable\":\"Le immagini non possono ancora essere copiate nel cloud.\",\"kind_widget\":\"Widget\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Testo\",\"kind_webapp\":\"App web\",\"kind_image\":\"Immagine\",\"drive_title\":\"Drive\",\"drive_upload\":\"Carica\",\"drive_uploading\":\"Caricamento…\",\"drive_bad_name\":\"Questo nome di file contiene caratteri che il drive non può archiviare. Lettere, cifre, spazi e . _ - ( ) + @ = sono sicuri.\",\"rename_bad_name\":\"Questo nome contiene caratteri che il drive non può archiviare. Modifica il nome e riprova.\",\"drive_bad_name_named\":\"Impossibile caricare “{{name}}”: il nome contiene caratteri che il drive non può archiviare. Lettere, cifre, spazi e . _ - ( ) + @ = sono sicuri.\",\"drive_upload_failed\":\"Impossibile caricare “{{name}}”. Riprova.\",\"section_files\":\"File\",\"section_library\":\"Libreria degli artefatti\",\"section_backup\":\"Backup\",\"share_title\":\"Condividi “{{name}}”\",\"share_expiry\":\"Il link scade dopo\",\"share_note\":\"Nota\",\"share_note_placeholder\":\"A cosa serve questo link?\",\"share_create\":\"Crea link\",\"share_creating\":\"Creazione…\",\"share_failed\":\"Impossibile creare il link di condivisione. Non è stato condiviso nulla.\",\"expiry_1h\":\"1 ora\",\"expiry_1d\":\"1 giorno\",\"expiry_7d\":\"7 giorni\",\"share_expires_note\":\"Il link smette di funzionare alla scadenza e non può essere revocato prima.\",\"share_credentials_caveat\":\"Potrebbe smettere di funzionare prima se la sessione di accesso dell'account termina per prima.\",\"cli_drawer_label\":\"Dove si trova\",\"cli_drawer_hint\":\"Questi file si trovano sotto {{prefix}} nel bucket {{bucket}}. Questo comando li elenca da un terminale che dispone delle tue credenziali.\",\"backup_title\":\"Backup\",\"backup_kind_snapshot\":\"Memoria e area di lavoro\",\"backup_kind_sessions\":\"Archivio delle sessioni\",\"backup_last_run\":\"Ultimo backup {{when}} · {{size}}\",\"backup_never\":\"Ancora nessun backup\",\"backup_never_recorded\":\"Nessuna esecuzione registrata qui: gli archivi precedenti potrebbero essere ancora sull'unità\",\"backup_remembered\":\"Archivi registrati da questa installazione: {{count}} · mostra l'elenco\",\"backup_sessions_scope\":\"Include i log di riproduzione della CLI di ogni sessione in questa home di Kiro, non solo delle chat avviate in {{productName}}.\",\"backup_run_now\":\"Esegui backup\",\"backup_running\":\"Backup in corso…\",\"backup_failed\":\"Ultimo backup non riuscito: {{reason}}\",\"backup_start_failed\":\"Impossibile avviare il backup.\",\"backup_start_retry\":\"Impossibile avviare il backup. Riprova.\",\"backup_start_unavailable\":\"I backup non sono disponibili per questa app. Verifica che il runtime dei processi sia registrato.\",\"backup_start_consent\":\"Concedi l'accesso a S3 per questo account, poi avvia il backup.\",\"backup_start_no_drive\":\"Questo account non ha ancora un disco. Creane uno, poi avvia il backup.\",\"backup_nightly\":\"Esegui il backup ogni notte\",\"backup_nightly_hint\":\"Esegue una volta al giorno uno snapshot di memoria e area di lavoro.\",\"backup_nightly_blocked_other_account\":\"Gli snapshot notturni vengono eseguiti solo per l’account predefinito, quindi per questo account non viene eseguito alcun backup.\",\"backup_nightly_sessions\":\"Salva le sessioni ogni notte\",\"backup_nightly_sessions_hint\":\"Carica l’archivio delle sessioni sul drive di questo account una volta al giorno. Contiene le tue conversazioni così come sono, senza rimuovere nulla.\",\"backup_nightly_sessions_destination\":\"Quel drive è uno spazio S3 in questo account AWS, e {{button}} invia l’archivio nello stesso posto.\",\"backup_nightly_sessions_blocked_host\":\"Questo computer non può creare l’archivio delle sessioni, quindi non viene caricato nulla.\",\"backup_nightly_sessions_blocked_redaction\":\"L’oscuramento dei dati in uscita è attivo e l’archivio delle sessioni non può ancora essere oscurato, quindi non viene caricato nulla.\",\"backup_nightly_sessions_blocked_other_account\":\"I caricamenti notturni vengono eseguiti solo per l’account predefinito, quindi per questo account non viene caricato nulla.\",\"backup_nightly_sessions_blocked_other\":\"I caricamenti notturni sono sospesi su questo computer, quindi non viene caricato nulla.\",\"backup_nightly_sessions_blocked_next\":\"Puoi comunque avviare il backup manualmente.\",\"backup_nightly_sessions_blocked_next_redaction\":\"Puoi comunque avviare il backup manualmente, ma l’archivio delle sessioni viene caricato senza oscuramento.\",\"backup_archive\":\"Backup archiviati\",\"backup_restore\":\"Ripristina\",\"backup_show_all_archives\":\"Mostra tutti ({{count}})\",\"backup_restore_caveat\":\"Il ripristino richiede l'accesso in lettura alla cartella dei backup. Il criterio con privilegi minimi consigliato concede intenzionalmente solo la scrittura, quindi verrà negato a meno che le credenziali dell'account non siano più ampie.\",\"backup_remote_error\":\"Al momento non è stato possibile leggere i backup archiviati.\",\"backup_status_failed\":\"Impossibile leggere lo stato dei backup.\",\"backup_nightly_failed\":\"Impossibile modificare “{{setting}}”. L’impostazione è rimasta invariata.\",\"backup_restore_failed\":\"Impossibile ripristinare quel backup. Non è stato scritto nulla.\",\"backup_restored_note\":\"I tuoi dati attuali non sono stati sostituiti. Il backup è stato scaricato in una cartella di staging al percorso qui sotto.\",\"backup_restore_recovered_note\":\"È stato scaricato il caricamento di questa stessa installazione, verificato rispetto a ciò che aveva registrato. Qualcos'altro l'aveva sovrascritto sul drive e può fare lo stesso con il tuo prossimo caricamento. Parti dalle altre installazioni che questa pagina indica come in backup su questo drive.\",\"backup_install\":\"Questa installazione\",\"backup_install_hint\":\"Ogni installazione salva i propri backup con un nome proprio, così un ripristino può distinguere gli archivi di questa installazione da quelli di un'altra installazione.\",\"backup_install_rename\":\"Rinomina\",\"backup_install_save\":\"Salva nome\",\"backup_install_rename_failed\":\"Impossibile salvare il nome dell’installazione. È rimasto invariato.\",\"backup_install_name_label\":\"Nome dell’installazione\",\"backup_attribution_self\":\"{{label}} · questa installazione\",\"backup_attribution_self_unnamed\":\"questa installazione\",\"backup_attribution_other\":\"«{{label}}» (un’altra installazione · {{id}})\",\"backup_attribution_other_unnamed\":\"un’altra installazione · {{id}}\",\"backup_attribution_unverified\":\"origine non verificata\",\"backup_origin_unknown\":\"origine sconosciuta\",\"backup_none_from_this_install\":\"Nessun backup da questa installazione. Includi gli archivi di altre installazioni per vedere i loro.\",\"backup_others_on_drive\":\"Altre installazioni che eseguono il backup su questo drive: {{count}}\",\"backup_show_others\":\"Includi gli archivi di altre installazioni\",\"backup_others_truncated\":\"Vengono mostrate solo le prime {{max}} altre installazioni.\",\"backup_archives_truncated\":\"Non è stato possibile elencare alcuni archivi di tipo {{kind}}. I più recenti potrebbero mancare.\",\"backup_shared_note\":\"Un drive condiviso da due installazioni non è memoria condivisa né sessioni condivise. Ogni backup è un archivio separato di un momento, e un ripristino scarica quel file solo in una cartella di staging — i file li sostituisci tu, con il gateway fermo.\",\"backup_restore_foreign_confirm\":\"Questo archivio è stato caricato da un'altra installazione ({{install}}). Ripristinarlo scarica i dati di quella installazione, non quelli di questa installazione. Scaricarlo comunque?\",\"backup_restore_unverified_confirm\":\"Questo archivio si trova nella cartella propria di questa installazione, ma questa installazione non ha alcuna traccia di averlo caricato. Chiunque possa scrivere sul drive può creare quella cartella, quindi potrebbe non essere di questa installazione. Scaricarlo comunque?\",\"backup_restore_unknown_confirm\":\"Questo archivio è stato caricato prima che le installazioni avessero un nome, quindi non si sa quale installazione l'abbia scritto. Scaricarlo comunque?\",\"backup_restore_overwritten_confirm\":\"Questa installazione ha caricato questo archivio, ma il drive non contiene più ciò che ha caricato: qualcos'altro l'ha sovrascritto nel frattempo. Scaricarlo comunque?\",\"backup_restore_overwritten_refused\":\"Questa installazione ha caricato questo archivio, ma il drive non contiene più ciò che ha caricato. Per scaricarlo comunque, apri Backup archiviati e scegli Scarica.\",\"backup_restore_foreign_refused\":\"Quell’archivio appartiene a un’altra installazione. Conferma il ripristino per scaricarlo comunque.\",\"backup_restore_confirm_yes\":\"Scarica\",\"backup_restore_confirm_no\":\"Annulla\",\"access_title\":\"Link di condivisione\",\"access_empty\":\"Nessun link di condivisione attivo.\",\"access_expires_in\":\"scade {{when}}\",\"access_forget\":\"Rimuovi dall'elenco\",\"access_object_missing\":\"File eliminato\",\"access_unchecked\":\"Questi link non sono stati verificati con il drive, quindi un file eliminato non viene segnalato qui.\",\"access_footer\":\"Rimuovere un link dall'elenco non lo revoca: un link condiviso continua a funzionare fino alla scadenza.\",\"access_list_failed\":\"Impossibile leggere i link di condivisione.\",\"access_forget_failed\":\"Impossibile rimuovere quel link dall'elenco. È ancora presente.\",\"keys_count_one\":\"{{count}} chiave\",\"keys_count_other\":\"{{count}} chiavi\",\"keys_count_many\":\"{{count}} chiavi\",\"keys_for_account\":\"Chiavi di {{name}}\",\"key_healthy\":\"Integra\",\"parent_folders\":\"Cartelle superiori\",\"folder_actions\":\"Azioni cartella\",\"file_actions\":\"Azioni file\",\"root_storage_used\":\"Cosa occupa lo spazio\",\"root_section_objects_one\":\"{{objects}} elemento\",\"root_section_objects_other\":\"{{objects}} elementi\",\"root_section_objects_many\":\"{{objects}} elementi\",\"view_grid\":\"Vista a griglia\",\"view_list\":\"Vista a elenco\",\"library_add\":\"Aggiungi dagli artefatti\",\"library_add_one\":\"Aggiungi a Libreria degli artefatti\",\"folder_open\":\"Apri la cartella {{name}}\",\"library_adding\":\"Aggiunta in corso…\",\"library_add_oneway\":\"Le copie occupano spazio nel cloud.\",\"library_add_again\":\"Aggiungi di nuovo\",\"library_add_count\":\"Aggiungi dagli artefatti ({{count}} pronti)\",\"library_add_nothing\":\"Non c’è altro da aggiungere: tutto ciò che può esserci è già qui.\",\"library_list_failed\":\"Impossibile leggere il contenuto nel cloud.\",\"files_list_failed\":\"Impossibile leggere questa cartella.\",\"library_local_failed\":\"Non è stato possibile leggere i tuoi artefatti.\",\"retry\":\"Riprova\",\"library_add_none\":\"Nessun artefatto corrisponde.\",\"library_update\":\"Aggiorna copia\",\"library_search\":\"Cerca i tuoi artefatti\",\"library_push_failed\":\"Impossibile aggiungere questo artefatto. Riprova.\",\"library_blurb\":\"Elementi creati da Kiro per te, copiati nel cloud. I file che carichi tu stesso si trovano in File.\",\"library_empty_title\":\"Nessun elemento ancora copiato nel cloud\",\"library_empty_body\":\"Questa cartella contiene gli elementi creati da Kiro per te — widget, pagine, documenti — dopo che li copi nel cloud. I file caricati dal computer vanno invece in File.\",\"library_cloud_only\":\"Solo nel cloud\",\"library_in_cloud\":\"Nel cloud\",\"library_stale_preview\":\"La copia nel cloud è v{{version}}; l'anteprima mostra la copia locale più recente\",\"library_stale_list\":\"La copia nel cloud è v{{version}}; la copia locale è più recente\",\"library_added\":\"Aggiunto {{when}}\",\"library_open\":\"Apri {{name}} in Artefatti\",\"files_empty_title\":\"File è vuoto\",\"files_empty_body\":\"Questa cartella contiene i file che carichi dal computer. È separata da Libreria degli artefatti, che contiene gli elementi creati da Kiro per te.\",\"library_remove\":\"Rimuovi\",\"library_remove_confirm\":\"Rimuovere «{{name}}» dalla libreria cloud?\",\"library_remove_confirm_slug\":\"Questo svuota la cartella cloud <folder>{{folder}}</folder>.\",\"library_actions\":\"Azioni sull'elemento della libreria\",\"library_remove_action\":\"Rimuovi la copia\",\"library_removing\":\"Rimozione in corso…\",\"library_remove_failed\":\"Rimozione non riuscita: la copia cloud è invariata. Riprova.\",\"move_conflict\":\"La cartella di destinazione contiene già un file con questo nome. Scegli un'altra cartella o rinomina prima il file.\",\"move_shared\":\"Questo file ha un link di condivisione attivo: spostarlo interromperebbe il link. Rimuovi la condivisione (o lascia che scada) e riprova.\",\"rename\":\"Rinomina\",\"preview_truncated\":\"File di grandi dimensioni: viene mostrato solo l'inizio.\",\"preview_redacted\":\"I valori sensibili sono mascherati in questa anteprima.\",\"preview_unsupported\":\"Questo tipo di file non può essere visualizzato in anteprima. Scaricalo per vederlo.\",\"preview_failed\":\"Impossibile caricare l’anteprima. Scarica il file per vederlo oppure riprova.\",\"search_files\":\"Cerca per nome file o percorso…\",\"search_clear\":\"Cancella ricerca\",\"search_pending\":\"Ricerca in corso…\",\"search_capped\":\"Troppi risultati: vengono mostrati solo i primi {{count}}.\",\"search_failed\":\"Ricerca non riuscita. Riprova.\",\"search_goto\":\"Apri cartella contenitore\",\"move_failed\":\"Impossibile spostare il file. Riprova.\",\"rename_conflict\":\"Qui esiste già un file con questo nome.\",\"rename_shared\":\"Questo file ha un link di condivisione attivo: rinominarlo interromperebbe il link. Rimuovi la condivisione (o lasciala scadere) e riprova.\",\"rename_failed\":\"Impossibile rinominare il file. Riprova.\",\"rename_failed_named\":\"Impossibile rinominare “{{name}}”: {{reason}}\",\"library_add_empty\":\"Nessun artefatto per ora. Ciò che Kiro crea per te comparirà qui, pronto per essere copiato nel cloud.\",\"move_to\":\"Sposta in una cartella…\",\"move_title\":\"Sposta “{{name}}” in\",\"move_root\":\"File (livello principale)\",\"move_up\":\"Su a {{name}}\",\"move_no_folders\":\"Qui non c’è un’altra cartella in cui spostarlo. Creane una prima.\",\"move_moving\":\"Spostamento…\",\"move_moving_picker\":\"Spostamento… Chiudere questa finestra non annulla lo spostamento.\",\"move_to_busy\":\"È ancora in corso un altro spostamento\",\"move_ask_agent\":\"Chiedi all'agente di questo spostamento\",\"stat_storage\":\"Archiviazione\",\"stat_objects\":\"Oggetti\",\"key_needs_attention\":\"Richiede attenzione\",\"backup_state_current\":\"Salvato\",\"backup_state_never\":\"Mai eseguito\",\"costs_refresh_failed\":\"L'ultima lettura della fattura non è riuscita. Questo è il valore in cache.\"},\"page\":{\"refresh\":\"Aggiorna\",\"health_ok\":\"Integro\",\"health_degraded\":\"Richiede attenzione\",\"health_unknown\":\"Sconosciuto\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Processo delle credenziali\",\"kind_other\":\"Altro\",\"default_profile\":\"Profilo predefinito\",\"not_connected_yet\":\"Non ancora connesso\",\"reconnect\":\"Riconnetti\",\"reconnect_loading\":\"Caricamento delle indicazioni per riconnettersi…\",\"reconnect_error\":\"Impossibile caricare le indicazioni per riconnettersi.\",\"reconnect_hint_sso\":\"Accedi di nuovo per rinnovare questa connessione, poi aggiorna questa pagina.\",\"reconnect_hint_credential_process\":\"Esegui questo comando nel terminale per rinnovare le credenziali, poi aggiorna questa pagina.\",\"reconnect_hint_other\":\"Esegui questo comando nel terminale per ripristinare la connessione, poi aggiorna questa pagina.\",\"copy\":\"Copia\",\"copied\":\"Copiato\",\"empty_title\":\"Ancora nessun account\",\"empty_body\":\"Registra uno dei profili AWS di questa macchina in Aggiungi account, qui sotto, e il suo account comparirà qui.\",\"error_title\":\"Impossibile caricare i tuoi account.\",\"error_body\":\"Qualcosa è andato storto durante la lettura dell'elenco degli account. Riprova tra un momento.\",\"error_forbidden_body\":\"Questa sessione della dashboard non è quella del proprietario, quindi non può gestire gli account AWS. Accedi come proprietario e riprova.\",\"retry\":\"Riprova\",\"disabled_title\":\"AWS Control è disattivato\",\"disabled_body\":\"Attiva l'app dall'App Store per vedere i tuoi account.\",\"aggregate_accounts_one\":\"{{count}} account\",\"aggregate_accounts_other\":\"{{count}} account\",\"aggregate_keys_one\":\"{{count}} chiave\",\"aggregate_keys_other\":\"{{count}} chiavi\",\"aggregate_healthy_one\":\"{{count}} integro\",\"aggregate_healthy_other\":\"{{count}} integri\",\"keys_summary_one\":\"{{count}} chiave\",\"keys_summary_other\":\"{{count}} chiavi\",\"add_accounts_title\":\"Aggiungi account\",\"add_accounts_summary\":\"Registra altri profili AWS di questa macchina\",\"add_accounts_intro\":\"Questi profili AWS locali non sono ancora registrati. Ognuno che aggiungi diventa una chiave del suo account.\",\"add_accounts_search_placeholder\":\"Cerca profili\",\"add_accounts_search_keeps_selected\":\"I profili che hai selezionato restano nell’elenco anche se non corrispondono.\",\"add_accounts_none\":\"Tutti i profili locali sono già registrati.\",\"add_accounts_no_profiles\":\"Questa macchina non ha ancora profili AWS. Creane prima uno (ad esempio, esegui aws configure in un terminale), poi registralo qui.\",\"add_accounts_unsupported\":\"Su Windows AWS Control non riesce a raggiungere i profili AWS di questa macchina: il suo accesso ad AWS richiede una shell Linux o macOS. Esegui il gateway {{productName}} in WSL (Windows Subsystem for Linux), poi registra lì i profili configurati.\",\"add_accounts_count_one\":\"{{count}} su {{max}} registrato\",\"add_accounts_count_other\":\"{{count}} su {{max}} registrati\",\"add_accounts_cap_reached\":\"Hai raggiunto il limite di {{max}} chiavi. Rimuovine una prima di aggiungerne altre.\",\"add_accounts_register\":\"Registra selezionati\",\"add_accounts_registering\":\"Registrazione…\",\"add_accounts_error\":\"Non è stato possibile registrare quei profili. Non è stato aggiunto nulla. Riprova.\",\"add_accounts_load_error\":\"Impossibile elencare i profili AWS locali.\",\"search_placeholder\":\"Cerca account\",\"aggregate_accounts_many\":\"{{count}} account\",\"aggregate_keys_many\":\"{{count}} chiavi\",\"aggregate_healthy_many\":\"{{count}} integri\",\"keys_summary_many\":\"{{count}} chiavi\",\"add_accounts_count_many\":\"{{count}} su {{max}} registrati\",\"paid_services_title\":\"Servizi a pagamento\",\"orphan_consent\":\"Confermato per un account AWS non registrato qui. Ritira la conferma qui sotto, oppure registra di nuovo quell'account per gestirlo dalla sua pagina.\",\"account_actions\":\"Azioni sull'account\",\"remove_account\":\"Rimuovi da AWS Control…\",\"remove_account_action\":\"Rimuovi\",\"remove_account_confirm\":\"Rimuovere «{{name}}» da AWS Control? Nulla cambia in AWS né nella configurazione della CLI AWS.\",\"remove_account_error\":\"Impossibile rimuovere l'account.\",\"remove_account_hint\":\"Nulla cambia in AWS\",\"forget_key_confirm\":\"Dimenticare la chiave «{{name}}» di questa riga? Nulla cambia in AWS né nella configurazione della CLI AWS.\",\"forget_key_action\":\"Dimentica chiave\",\"totals_summary_one\":\"{{accounts}} account · {{keys}}\",\"totals_summary_many\":\"{{accounts}} account · {{keys}}\",\"totals_summary_other\":\"{{accounts}} account · {{keys}}\",\"keys_healthy_one\":\"chiavi integre: {{healthy}}/{{n}}\",\"keys_healthy_many\":\"chiavi integre: {{healthy}}/{{n}}\",\"keys_healthy_other\":\"chiavi integre: {{healthy}}/{{n}}\"},\"rail\":{\"accounts\":\"Account e credenziali\",\"nav\":\"Sezioni di AWS Control\",\"switch_account\":\"Cambia account\",\"usage\":\"Utilizzo e costi\",\"use_account\":\"Usa questo account\"},\"overview\":{\"title\":\"Panoramica\",\"subtitle\":\"Un'unica stanza per gli account, le chiavi, l'unità cloud e i servizi a pagamento che i tuoi agenti possono usare.\",\"stat_accounts\":\"Account\",\"stat_accounts_attention_one\":\"{{count}} richiede attenzione\",\"stat_accounts_attention_other\":\"{{count}} richiedono attenzione\",\"stat_accounts_all_ok\":\"Tutto a posto\",\"stat_keys\":\"Chiavi in salute\",\"stat_keys_sub_one\":\"{{count}} chiave registrata\",\"stat_keys_sub_other\":\"{{count}} chiavi registrate\",\"stat_drive\":\"Spazio usato\",\"stat_drive_none\":\"Nessuna unità\",\"stat_spend\":\"Mese in corso\",\"stat_spend_consent\":\"Report costi disattivato\",\"stat_shares_none\":\"Niente condiviso\",\"stat_shares_sub_one\":\"{{count}} link attivo\",\"stat_shares_sub_other\":\"{{count}} link attivi\",\"stat_backups_nightly\":\"Notturno\",\"stat_backups_manual\":\"Manuale\",\"stat_backups_sub_nightly\":\"Parte ogni notte\",\"stat_backups_sub_manual\":\"Nessuna pianificazione\",\"accounts_title\":\"Account\",\"accounts_note\":\"Gli agenti usano queste chiavi senza mai vederle. Nulla di una chiave compare in una chat.\",\"add_account\":\"Aggiungi account\",\"drive_title\":\"Unità cloud\",\"drive_bar_label\":\"{{size}} archiviati, tra file, libreria artifact e backup\",\"drive_empty_title\":\"Nessuna unità cloud\",\"drive_empty_body\":\"Crea un bucket privato e cifrato in questo account per i tuoi file, la libreria artifact e i backup.\",\"drive_setup\":\"Configura unità cloud\",\"stat_accounts_attention_many\":\"{{count}} richiedono attenzione\",\"stat_keys_sub_many\":\"{{count}} chiavi registrate\",\"stat_shares_sub_many\":\"{{count}} link attivi\",\"drive_bucket_label\":\"Bucket\",\"stat_spend_scope\":\"Fattura AWS di questo account\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "Conferma l'uso di AWS prima della prima richiesta",
				"confirmed_title": "Uso di AWS confermato",
				"account_changed": "La conferma riguardava un altro account AWS, quindi e stata revocata. Controlla l'account qui sotto e conferma di nuovo.",
				"service": "Servizio",
				"region": "Regione",
				"credential_source": "Origine delle credenziali",
				"aws_account": "Account AWS",
				"provider_default": "(valore predefinito del provider)",
				"unresolved_account": "non e stato possibile risolverlo",
				"billing_notice": "Questo e un servizio AWS a pagamento. Fino alla conferma non viene inviata alcuna richiesta.",
				"confirm_button": "Conferma e attiva",
				"withdraw": "Revoca la conferma",
				"status_failed": "Impossibile leggere lo stato della conferma.",
				"confirm_failed": "La conferma non è stata registrata.",
				"withdraw_failed": "La conferma non è stata revocata.",
				"retry": "Riprova",
				"badge_confirmed": "Confermato",
				"badge_not_enabled": "Non attivo",
				"confirmed_on": "confermato {{date}}",
				"billing_notice_short": "A pagamento. Non inviamo nulla finché non confermi.",
				"pending_profile_hint": "Finisci di modificare il profilo AWS per confermare.",
				"bedrock_kb_billing_short": "Addebitato a ogni ricerca: una chiamata Bedrock Retrieve per Knowledge Base",
				"aws_pricing_link": "Prezzi AWS",
				"withdraw_effect": "Ritirandola, gli agenti smettono di usare questo servizio finché non confermi di nuovo."
			},
			"ui": {
				"clear_filter": "Cancella filtro",
				"no_matches_for": "Nessuna corrispondenza per",
				"no_noun_match": "Nessun(a) {{noun}} corrispondente"
			}
		}
	},
	ja: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"クラウドアカウントを、わかりやすい言葉で。Kiro Crew が使用できるすべての AWS アカウントを、アカウントごとのヘルスライトと認証方式に合わせた再接続ガイダンスとともに確認できます。さらに、S3 を基盤としたクラウドドライブ（ファイル、クラウドアーティファクトライブラリー、バックアップ）と、期限付きの共有リンクも利用できます。あなたが指定しない限り何も公開されず、課金が発生する有料サービスはすべて、請求前に確認を求めます。\",\"display_name\":\"AWS Control\",\"highlight_1\":\"アカウントごとに 1 つのヘルスライトを表示し、それぞれにプロファイルの認証方式に合わせた再接続ガイダンスが付きます\",\"highlight_2\":\"プライベートで暗号化され、バージョン管理されたストレージを、あなたが確認したあとにのみ作成します\",\"highlight_3\":\"クラウドアーティファクトライブラリー、ファイル、バックアップのすべてが、あなたが所有する 1 つのバケットに保存されます\",\"highlight_4\":\"共有リンクは必ず期限切れになります。あなたが指定しない限り何も公開されません\",\"highlight_5\":\"有料サービスはすべて、初回使用前にアカウントごとに確認され、すべての変更が記録されます\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Kiro Crew がアクセスできる AWS アカウント、接続の健全性、今月の料金を、AWS コンソールを開かずに把握できます。\",\"configuration_1\":\"このマシンにあるプロファイルからアカウントを追加し、有料サービスは初回利用前にアカウントごとに確認します。\"},\"console\":{\"copy\":\"コピー\",\"copied\":\"コピーしました\",\"close\":\"閉じる\",\"loading\":\"読み込み中…\",\"download\":\"ダウンロード\",\"share\":\"共有\",\"delete\":\"削除\",\"delete_failed\":\"削除に失敗しました。ファイルは変更されていません。もう一度お試しください。\",\"delete_failed_named\":\"「{{name}}」を削除できませんでした。ファイルは変更されていません。もう一度お試しください。\",\"download_failed\":\"ダウンロードを開始できませんでした。何も送信されていません。もう一度お試しください。\",\"delete_confirm_action\":\"ファイルを削除\",\"delete_confirm\":\"「{{name}}」を削除しますか？ファイルはドライブから削除されます。\",\"col_name\":\"名前\",\"col_kind\":\"種類\",\"col_size\":\"サイズ\",\"col_modified\":\"更新日時\",\"col_actions\":\"アクション\",\"kind_folder\":\"フォルダー\",\"folder_new\":\"新しいフォルダー\",\"folder_name\":\"フォルダー名\",\"folder_delete_confirm\":\"「{{name}}」とその中のすべてを削除しますか？\",\"folder_delete_action\":\"フォルダーを削除\",\"folder_delete_failed\":\"フォルダーを削除できませんでした。\",\"folder_create_failed\":\"フォルダーを作成できませんでした。\",\"folder_bad_name\":\"このフォルダー名には、ドライブが保存できない文字が含まれています。英数字、スペース、および . _ - ( ) + @ = は使用できます。\",\"folder_deleted_other\":\"「{{name}}」を削除しました：{{count}} 個の項目。\",\"cancel\":\"キャンセル\",\"load_more\":\"さらに読み込む\",\"stat_this_month\":\"今月\",\"storage_consent_needed\":\"このアカウントのクラウドストレージはまだ確認されていません。下で確認してから更新してください。\",\"stat_stored_value\":\"{{size}} · {{objects}} 個の項目\",\"costs_as_of\":\"{{date}} 時点のキャッシュされた数値です。\",\"costs_consent_missing\":\"このアカウントの支出を表示するには、以下でコストレポートを有効にしてください。\",\"costs_unavailable\":\"現在、請求情報を読み取れません。\",\"account_unavailable\":\"このアカウントには現在接続できません。再接続してから、もう一度お試しください。\",\"drive_status_failed\":\"ドライブを今読み取れませんでした。\",\"setup_title\":\"クラウドドライブをセットアップ\",\"setup_body\":\"これにより、あなた自身のアカウントに、ファイル、アーティファクトライブラリー、バックアップ用の、プライベートで暗号化され、バージョン管理されたストレージバケットを 1 つ作成します。\",\"setup_searched_region\":\"{{region}} にドライブが見つかりません。検索したのはこのリージョンだけなので、このアカウントの別のリージョンにあるドライブはここに表示されません。\",\"setup_costs_note\":\"コストは使用量に応じて発生します。保存した分だけ AWS に支払い、それ以前には何も発生しません。\",\"setup_preview_region\":\"リージョン\",\"setup_preview_resource\":\"リソース\",\"setup_preview_btn\":\"プレビュー\",\"setup_confirm_btn\":\"作成する\",\"setup_creating\":\"作成中…\",\"setup_error\":\"ドライブを準備できませんでした。しばらくしてからもう一度お試しください。\",\"setup_confirm_error\":\"ドライブを作成できませんでした。何も変更されていません。下の権限を確認してからもう一度お試しください。\",\"setup_policy_error\":\"貼り付ける権限を読み込めませんでした。\",\"setup_policy_label\":\"貼り付ける正確なアクセス許可を表示\",\"library_all\":\"すべて\",\"library_not_pushable\":\"画像はまだクラウドにコピーできません。\",\"kind_widget\":\"ウィジェット\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"テキスト\",\"kind_webapp\":\"ウェブアプリ\",\"kind_image\":\"画像\",\"drive_title\":\"ドライブ\",\"drive_upload\":\"アップロード\",\"drive_uploading\":\"アップロード中…\",\"drive_bad_name\":\"そのファイル名には、ドライブが保存できない文字が含まれています。英数字、スペース、および . _ - ( ) + @ = は使用できます。\",\"rename_bad_name\":\"その名前には、ドライブが保存できない文字が含まれています。名前を修正してもう一度お試しください。\",\"drive_bad_name_named\":\"「{{name}}」はアップロードできません——ファイル名にドライブが保存できない文字が含まれています。英数字、スペース、および . _ - ( ) + @ = は使用できます。\",\"drive_upload_failed\":\"「{{name}}」のアップロードに失敗しました。もう一度お試しください。\",\"section_files\":\"ファイル\",\"section_library\":\"アーティファクトライブラリー\",\"section_backup\":\"バックアップ\",\"share_title\":\"「{{name}}」を共有\",\"share_expiry\":\"リンクの有効期限\",\"share_note\":\"メモ\",\"share_note_placeholder\":\"このリンクは何のためのものですか？\",\"share_create\":\"リンクを作成\",\"share_creating\":\"作成中…\",\"share_failed\":\"共有リンクを作成できませんでした。何も共有されていません。\",\"expiry_1h\":\"1 時間\",\"expiry_1d\":\"1 日\",\"expiry_7d\":\"7 日間\",\"share_expires_note\":\"リンクは期限が切れると使えなくなり、それより早く取り消すことはできません。\",\"share_credentials_caveat\":\"アカウントのサインインセッションが先に終了した場合は、より早く使えなくなることがあります。\",\"cli_drawer_label\":\"保存場所\",\"cli_drawer_hint\":\"これらのファイルは、バケット {{bucket}} の {{prefix}} の下に保存されています。このコマンドは、あなたの認証情報を持つターミナルからそれらを一覧表示します。\",\"backup_title\":\"バックアップ\",\"backup_kind_snapshot\":\"メモリーとワークスペース\",\"backup_kind_sessions\":\"セッションアーカイブ\",\"backup_last_run\":\"最終バックアップ {{when}} · {{size}}\",\"backup_never\":\"まだバックアップされていません\",\"backup_never_recorded\":\"ここに記録された実行はありません — 以前のアーカイブはまだドライブに残っている可能性があります\",\"backup_remembered\":\"このインストールが記録したアーカイブ：{{count}} · 一覧を表示\",\"backup_sessions_scope\":\"この Kiro ホーム配下のすべてのセッションの CLI 再生ログが含まれます。{{productName}} で開始したチャットだけではありません。\",\"backup_run_now\":\"今すぐバックアップ\",\"backup_running\":\"バックアップ中…\",\"backup_failed\":\"前回のバックアップに失敗しました: {{reason}}\",\"backup_start_failed\":\"バックアップを開始できませんでした。\",\"backup_start_retry\":\"バックアップを開始できませんでした。もう一度お試しください。\",\"backup_start_unavailable\":\"このアプリではバックアップを利用できません。ジョブランタイムが登録されているか確認してください。\",\"backup_start_consent\":\"このアカウントに S3 アクセスを許可してから、バックアップを開始してください。\",\"backup_start_no_drive\":\"このアカウントにはまだドライブがありません。作成してからバックアップを開始してください。\",\"backup_nightly\":\"毎晩バックアップする\",\"backup_nightly_hint\":\"メモリーとワークスペースのスナップショットを 1 日 1 回実行します。\",\"backup_nightly_blocked_other_account\":\"夜間のスナップショットは既定のアカウントに対してのみ実行されるため、このアカウントは何もバックアップされません。\",\"backup_nightly_sessions\":\"セッションを毎夜バックアップ\",\"backup_nightly_sessions_hint\":\"セッションのアーカイブをこのアカウントのドライブに 1 日 1 回アップロードします。会話はそのまま含まれ、何も削除されません。\",\"backup_nightly_sessions_destination\":\"そのドライブはこの AWS アカウント内の S3 ストレージで、{{button}} も同じ場所にアーカイブを送ります。\",\"backup_nightly_sessions_blocked_host\":\"このコンピューターではセッションのアーカイブを作成できないため、何もアップロードされません。\",\"backup_nightly_sessions_blocked_redaction\":\"送信時の秘匿が有効ですが、セッションのアーカイブはまだ秘匿できないため、何もアップロードされません。\",\"backup_nightly_sessions_blocked_other_account\":\"夜間のアップロードは既定のアカウントに対してのみ実行されるため、このアカウントでは何もアップロードされません。\",\"backup_nightly_sessions_blocked_other\":\"このコンピューターでは夜間のアップロードが保留されているため、何もアップロードされません。\",\"backup_nightly_sessions_blocked_next\":\"バックアップは自分で開始できます。\",\"backup_nightly_sessions_blocked_next_redaction\":\"バックアップは自分で開始できますが、セッションのアーカイブは秘匿されずにアップロードされます。\",\"backup_archive\":\"保存済みバックアップ\",\"backup_restore\":\"復元\",\"backup_show_all_archives\":\"すべてを表示（{{count}}）\",\"backup_restore_caveat\":\"復元にはバックアップフォルダーへの読み取りアクセスが必要です。推奨される最小権限ポリシーは意図的に書き込みのみを許可しているため、アカウントの認証情報がより広い権限を持たない限り拒否されます。\",\"backup_remote_error\":\"保存済みバックアップを今読み取れませんでした。\",\"backup_status_failed\":\"バックアップの状態を読み取れませんでした。\",\"backup_nightly_failed\":\"「{{setting}}」を変更できませんでした。設定は変わっていません。\",\"backup_restore_failed\":\"そのバックアップを復元できませんでした。何も書き込まれていません。\",\"backup_restored_note\":\"現在のデータは置き換えられていません。バックアップは、以下のパスにあるステージングフォルダーにダウンロードされました。\",\"backup_restore_recovered_note\":\"このインストール自身がアップロードしたものをダウンロードし、記録と照合しました。ドライブ上では別の何かがこれを上書きしていたため、次回のアップロードも同じように上書きされるおそれがあります。まず、このページに表示されている、同じドライブにバックアップしているほかのインストールを確認してください。\",\"backup_install\":\"このインストール\",\"backup_install_hint\":\"各インストールは自分の名前でバックアップを保存するため、復元時にこのインストールのアーカイブと別のインストールのアーカイブを見分けられます。\",\"backup_install_rename\":\"名前を変更\",\"backup_install_save\":\"名前を保存\",\"backup_install_rename_failed\":\"インストール名を保存できませんでした。変更されていません。\",\"backup_install_name_label\":\"インストール名\",\"backup_attribution_self\":\"{{label}} · このインストール\",\"backup_attribution_self_unnamed\":\"このインストール\",\"backup_attribution_other\":\"「{{label}}」（別のインストール · {{id}}）\",\"backup_attribution_other_unnamed\":\"別のインストール · {{id}}\",\"backup_attribution_unverified\":\"未確認の出所\",\"backup_origin_unknown\":\"不明な出所\",\"backup_none_from_this_install\":\"このインストールからのバックアップはありません。他のインストールのアーカイブを含めると、それらを表示できます。\",\"backup_others_on_drive\":\"このドライブにバックアップしている他のインストール：{{count}}\",\"backup_show_others\":\"他のインストールのアーカイブを含める\",\"backup_others_truncated\":\"最初の {{max}} 件の他のインストールのみ表示しています。\",\"backup_archives_truncated\":\"{{kind}} のアーカイブの一部を一覧表示できませんでした。最新のものが表示されていない可能性があります。\",\"backup_shared_note\":\"2つのインストールで1つのドライブを共有しても、メモリの共有にもセッションの共有にもなりません。各バックアップはある瞬間の個別のアーカイブであり、復元はそのファイルをステージングフォルダーにダウンロードするだけです — ファイルの置き換えは、gateway を停止した状態で自分で行います。\",\"backup_restore_foreign_confirm\":\"このアーカイブは別のインストール（{{install}}）によってアップロードされました。復元すると、このインストールではなくそのインストールのデータをダウンロードします。それでもダウンロードしますか？\",\"backup_restore_unverified_confirm\":\"このアーカイブはこのインストール自身のフォルダーに保存されていますが、このインストールにはアップロードした記録がありません。ドライブに書き込める者なら誰でもそのフォルダーを作成できるため、このインストールのものではない可能性があります。それでもダウンロードしますか？\",\"backup_restore_unknown_confirm\":\"このアーカイブはインストールに名前が付けられる前にアップロードされたため、どのインストールが書き込んだかは不明です。それでもダウンロードしますか？\",\"backup_restore_overwritten_confirm\":\"このアーカイブはこのインストールがアップロードしたものですが、ドライブに今あるのはアップロードした内容ではありません。その後に別の何かが上書きしています。それでもダウンロードしますか？\",\"backup_restore_overwritten_refused\":\"このアーカイブはこのインストールがアップロードしたものですが、ドライブに今あるのはアップロードした内容ではありません。それでもダウンロードするには、保存済みバックアップを開いてダウンロードを選択してください。\",\"backup_restore_foreign_refused\":\"そのアーカイブは別のインストールのものです。それでもダウンロードするには復元を確認してください。\",\"backup_restore_confirm_yes\":\"ダウンロード\",\"backup_restore_confirm_no\":\"キャンセル\",\"access_title\":\"共有リンク\",\"access_empty\":\"有効な共有リンクはありません。\",\"access_expires_in\":\"有効期限 {{when}}\",\"access_forget\":\"リストから削除\",\"access_object_missing\":\"ファイルは削除済み\",\"access_unchecked\":\"これらのリンクはドライブと照合されていないため、削除されたファイルはここに表示されません。\",\"access_footer\":\"リストからリンクを削除しても無効にはなりません。共有リンクは期限切れまで機能し続けます。\",\"access_list_failed\":\"共有リンクを読み取れませんでした。\",\"access_forget_failed\":\"そのリンクを一覧から削除できませんでした。まだ一覧に残っています。\",\"keys_count_other\":\"キー {{count}} 個\",\"keys_for_account\":\"{{name}} のキー\",\"key_healthy\":\"正常\",\"parent_folders\":\"上位フォルダー\",\"folder_actions\":\"フォルダーの操作\",\"file_actions\":\"ファイルの操作\",\"root_storage_used\":\"ストレージの使用内訳\",\"root_section_objects_other\":\"{{objects}} 件\",\"view_grid\":\"グリッド表示\",\"view_list\":\"リスト表示\",\"library_add\":\"アーティファクトから追加\",\"library_add_one\":\"「アーティファクトライブラリー」に追加\",\"folder_open\":\"フォルダー {{name}} を開く\",\"library_adding\":\"追加中…\",\"library_add_oneway\":\"ここのコピーはクラウドの容量を使います。\",\"library_add_again\":\"もう一度追加\",\"library_add_count\":\"アーティファクトから追加（{{count}} 件が利用可能）\",\"library_add_nothing\":\"追加できるものはもうありません。\",\"library_list_failed\":\"クラウドの内容を読み取れませんでした。\",\"files_list_failed\":\"このフォルダーを読み取れませんでした。\",\"library_local_failed\":\"アーティファクトを読み取れませんでした。\",\"retry\":\"再試行\",\"library_add_none\":\"一致するアーティファクトはありません。\",\"library_update\":\"コピーを更新\",\"library_search\":\"アーティファクトを検索\",\"library_push_failed\":\"このアーティファクトを追加できませんでした。もう一度お試しください。\",\"library_blurb\":\"Kiro が作成したものを、クラウドにコピーしたものです。自分でアップロードしたファイルは「ファイル」にあります。\",\"library_empty_title\":\"まだクラウドに何もコピーされていません\",\"library_empty_body\":\"このフォルダーには、Kiro が作成したもの（ウィジェット、ページ、ドキュメント）を、クラウドにコピーすると入ります。コンピューターからアップロードしたファイルは、代わりに「ファイル」に入れてください。\",\"library_cloud_only\":\"クラウドのみ\",\"library_in_cloud\":\"クラウドにあります\",\"library_stale_preview\":\"クラウド上は v{{version}} です。プレビューはより新しいローカルの内容です\",\"library_stale_list\":\"クラウドのコピーは v{{version}} で、ローカルのコピーの方が新しいです\",\"library_added\":\"{{when}} に追加\",\"library_open\":\"アーティファクトで {{name}} を開く\",\"files_empty_title\":\"「ファイル」は空です\",\"files_empty_body\":\"このフォルダーには、コンピューターからアップロードしたファイルが入ります。Kiro が作成したものが入る「アーティファクトライブラリー」とは別です。\",\"library_remove\":\"削除\",\"library_remove_confirm\":\"「{{name}}」をクラウドライブラリから削除しますか？\",\"library_remove_confirm_slug\":\"これによりクラウドフォルダー <folder>{{folder}}</folder> が空になります。\",\"library_actions\":\"ライブラリ項目の操作\",\"library_remove_action\":\"コピーを削除\",\"library_removing\":\"削除中…\",\"library_remove_failed\":\"削除に失敗しました。クラウドのコピーは変更されていません。もう一度お試しください。\",\"move_conflict\":\"移動先のフォルダーには同じ名前のファイルがすでにあります。別のフォルダーを選ぶか、先にファイル名を変更してください。\",\"move_shared\":\"このファイルには有効な共有リンクがあります——移動するとリンクが無効になります。共有を削除するか期限切れを待ってから、もう一度お試しください。\",\"rename\":\"名前を変更\",\"preview_truncated\":\"ファイルが大きいため、先頭部分のみ表示しています。\",\"preview_redacted\":\"このプレビューでは機密性の高い値がマスクされています。\",\"preview_unsupported\":\"このファイル形式はプレビューできません。ダウンロードしてご覧ください。\",\"preview_failed\":\"プレビューを読み込めませんでした。ダウンロードしてご覧になるか、もう一度お試しください。\",\"search_files\":\"ファイル名またはパスで検索…\",\"search_clear\":\"検索をクリア\",\"search_pending\":\"検索中…\",\"search_capped\":\"一致が多すぎるため、先頭の {{count}} 件のみ表示しています。\",\"search_failed\":\"検索に失敗しました。もう一度お試しください。\",\"search_goto\":\"格納フォルダーを開く\",\"move_failed\":\"ファイルを移動できませんでした。もう一度お試しください。\",\"rename_conflict\":\"同じ名前のファイルがここに既にあります。\",\"rename_shared\":\"このファイルには有効な共有リンクがあります。名前を変更するとリンクが無効になります。共有を削除（または期限切れを待って）してから再試行してください。\",\"rename_failed\":\"ファイル名を変更できませんでした。再試行してください。\",\"rename_failed_named\":\"「{{name}}」の名前を変更できませんでした：{{reason}}\",\"library_add_empty\":\"アーティファクトはまだありません。Kiro が作成したものはここに表示され、クラウドにコピーできます。\",\"move_to\":\"フォルダーに移動…\",\"move_title\":\"「{{name}}」の移動先\",\"move_root\":\"ファイル（最上位）\",\"move_up\":\"上の {{name}} へ\",\"move_no_folders\":\"ここには移動先となる別のフォルダーがありません。まずフォルダーを作成してください。\",\"move_moving\":\"移動中…\",\"move_moving_picker\":\"移動中…閉じても移動はキャンセルされません。\",\"move_to_busy\":\"別の移動を実行中です\",\"move_ask_agent\":\"この移動についてエージェントに質問\",\"stat_storage\":\"ストレージ\",\"stat_objects\":\"オブジェクト\",\"key_needs_attention\":\"対応が必要\",\"backup_state_current\":\"バックアップ済み\",\"backup_state_never\":\"未実行\",\"costs_refresh_failed\":\"最新の請求額の読み取りに失敗しました。表示中の数値はキャッシュです。\"},\"page\":{\"refresh\":\"更新\",\"health_ok\":\"正常\",\"health_degraded\":\"要確認\",\"health_unknown\":\"不明\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"認証情報プロセス\",\"kind_other\":\"その他\",\"default_profile\":\"既定のプロファイル\",\"not_connected_yet\":\"未接続\",\"reconnect\":\"再接続\",\"reconnect_loading\":\"再接続の案内を読み込んでいます…\",\"reconnect_error\":\"再接続の案内を読み込めませんでした。\",\"reconnect_hint_sso\":\"もう一度サインインしてこの接続を更新し、その後このページを更新してください。\",\"reconnect_hint_credential_process\":\"ターミナルでこのコマンドを実行して認証情報を更新し、その後このページを更新してください。\",\"reconnect_hint_other\":\"ターミナルでこのコマンドを実行して接続を復旧し、その後このページを更新してください。\",\"copy\":\"コピー\",\"copied\":\"コピーしました\",\"empty_title\":\"アカウントはまだありません\",\"empty_body\":\"下の「アカウントを追加」でこのマシンの AWS プロファイルを登録すると、そのアカウントがここに表示されます。\",\"error_title\":\"アカウントを読み込めませんでした。\",\"error_body\":\"アカウント一覧の読み込み中に問題が発生しました。しばらくしてからもう一度お試しください。\",\"error_forbidden_body\":\"このダッシュボードセッションは所有者のものではないため、AWS アカウントを管理できません。所有者としてサインインしてから、もう一度お試しください。\",\"retry\":\"再試行\",\"disabled_title\":\"AWS Control は無効です\",\"disabled_body\":\"アカウントを表示するには、App Store でこのアプリを有効にしてください。\",\"aggregate_accounts_other\":\"アカウント {{count}} 件\",\"aggregate_keys_other\":\"キー {{count}} 個\",\"aggregate_healthy_other\":\"正常 {{count}} 件\",\"keys_summary_other\":\"キー {{count}} 個\",\"add_accounts_title\":\"アカウントを追加\",\"add_accounts_summary\":\"このマシンの AWS プロファイルをさらに登録する\",\"add_accounts_intro\":\"これらのローカル AWS プロファイルはまだ登録されていません。追加したものは、それぞれのアカウントのキーになります。\",\"add_accounts_search_placeholder\":\"プロファイルを検索\",\"add_accounts_search_keeps_selected\":\"選択したプロファイルは、検索に一致しなくても一覧に残ります。\",\"add_accounts_none\":\"ローカルプロファイルはすべて登録済みです。\",\"add_accounts_no_profiles\":\"このマシンにはまだ AWS プロファイルがありません。まずプロファイルを作成し（例: ターミナルで aws configure を実行）、ここで登録してください。\",\"add_accounts_unsupported\":\"Windows では AWS Control はこのマシンの AWS プロファイルにアクセスできません。AWS へのアクセスには Linux または macOS のシェルが必要です。WSL (Windows Subsystem for Linux) で {{productName}} のゲートウェイを実行し、そこで設定したプロファイルを登録してください。\",\"add_accounts_count_other\":\"{{max}} 件のうち {{count}} 件を登録済み\",\"add_accounts_cap_reached\":\"キーの上限 {{max}} 個に達しました。追加するには、まず 1 個を削除してください。\",\"add_accounts_register\":\"選択したものを登録\",\"add_accounts_registering\":\"登録中…\",\"add_accounts_error\":\"それらのプロファイルを登録できませんでした。何も追加されていません。もう一度お試しください。\",\"add_accounts_load_error\":\"ローカルの AWS プロファイルを一覧できませんでした。\",\"search_placeholder\":\"アカウントを検索\",\"paid_services_title\":\"有料サービス\",\"orphan_consent\":\"ここに登録されていない AWS アカウントに対して確認済みです。下で確認を取り消すか、そのアカウントを再登録して専用ページから管理してください。\",\"account_actions\":\"アカウントの操作\",\"remove_account\":\"AWS Control から削除…\",\"remove_account_action\":\"削除\",\"remove_account_confirm\":\"「{{name}}」を AWS Control から削除しますか？AWS や AWS CLI の設定は何も変わりません。\",\"remove_account_error\":\"アカウントを削除できませんでした。\",\"remove_account_hint\":\"AWS 側は何も変わりません\",\"forget_key_confirm\":\"この行のキー「{{name}}」を忘れますか？AWS や AWS CLI の設定は何も変わりません。\",\"forget_key_action\":\"キーを忘れる\",\"totals_summary_other\":\"アカウント {{accounts}} 件 · {{keys}}\",\"keys_healthy_other\":\"キー {{n}} 個のうち {{healthy}} 個が正常\"},\"rail\":{\"accounts\":\"アカウントと認証情報\",\"nav\":\"AWS Control のセクション\",\"switch_account\":\"アカウントを切り替え\",\"usage\":\"使用量とコスト\",\"use_account\":\"このアカウントを使用\"},\"overview\":{\"title\":\"概要\",\"subtitle\":\"エージェントが利用できるアカウント、キー、クラウドドライブ、有料サービスをここでまとめて管理します。\",\"stat_accounts\":\"アカウント\",\"stat_accounts_attention_other\":\"{{count}}件が対応必要\",\"stat_accounts_all_ok\":\"すべて正常\",\"stat_keys\":\"キーは正常\",\"stat_keys_sub_other\":\"キー{{count}}件を登録済み\",\"stat_drive\":\"ドライブ使用量\",\"stat_drive_none\":\"ドライブなし\",\"stat_spend\":\"今月の累計\",\"stat_spend_consent\":\"コストレポートはオフ\",\"stat_shares_none\":\"共有なし\",\"stat_shares_sub_other\":\"有効なリンク{{count}}件\",\"stat_backups_nightly\":\"毎晩\",\"stat_backups_manual\":\"手動\",\"stat_backups_sub_nightly\":\"毎晩実行\",\"stat_backups_sub_manual\":\"スケジュール未設定\",\"accounts_title\":\"アカウント\",\"accounts_note\":\"エージェントはこれらのキーを使いますが、キー自体を見ることはありません。キーの内容がチャットに現れることはありません。\",\"add_account\":\"アカウントを追加\",\"drive_title\":\"クラウドドライブ\",\"drive_bar_label\":\"{{size}}を保存中。ファイル、アーティファクトライブラリ、バックアップに分散しています。\",\"drive_empty_title\":\"クラウドドライブがありません\",\"drive_empty_body\":\"このアカウントに非公開の暗号化バケットを1つ作成し、ファイル、アーティファクトライブラリ、バックアップを保存します。\",\"drive_setup\":\"クラウドドライブを設定\",\"drive_bucket_label\":\"バケット\",\"stat_spend_scope\":\"このアカウントの AWS 請求額\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "最初のリクエスト前に AWS の利用を確認",
				"confirmed_title": "AWS の利用を確認済み",
				"account_changed": "以前は別の AWS アカウントで確認されていたため、確認を取り消しました。以下のアカウントを確認して、再度承認してください。",
				"service": "サービス",
				"region": "リージョン",
				"credential_source": "認証情報のソース",
				"aws_account": "AWS アカウント",
				"provider_default": "(プロバイダーの既定値)",
				"unresolved_account": "解決できませんでした",
				"billing_notice": "これは有料の AWS サービスです。確認するまでリクエストは送信されません。",
				"confirm_button": "確認して有効化",
				"withdraw": "確認を取り消す",
				"status_failed": "確認の状態を読み取れませんでした。",
				"confirm_failed": "確認は記録されませんでした。",
				"withdraw_failed": "確認は取り消されませんでした。",
				"retry": "再試行",
				"badge_confirmed": "確認済み",
				"badge_not_enabled": "無効",
				"confirmed_on": "{{date}}に確認済み",
				"billing_notice_short": "課金対象です。確認するまで送信されません。",
				"pending_profile_hint": "AWS プロファイルの入力を終えると確認できます。",
				"bedrock_kb_billing_short": "検索ごとに課金：Knowledge Base ごとに Bedrock Retrieve を 1 回呼び出し",
				"aws_pricing_link": "AWS の料金",
				"withdraw_effect": "撤回すると、再度確認するまでエージェントはこのサービスを使えなくなります。"
			},
			"ui": {
				"clear_filter": "フィルターをクリア",
				"no_matches_for": "一致しません:",
				"no_noun_match": "{{noun}}に一致しません"
			}
		}
	},
	ko: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"여러분의 클라우드 계정을 쉬운 언어로 보여줍니다. Kiro Crew가 사용할 수 있는 모든 AWS 계정을 계정별 상태 표시등과 함께 확인하고, 인증 방식에 맞춘 재연결 안내를 받을 수 있습니다. 또한 S3 기반 클라우드 드라이브(파일, 클라우드 아티팩트 라이브러리, 백업)와 기한이 정해진 공유 링크도 제공합니다. 직접 지정하지 않는 한 어떤 것도 공개되지 않으며, 유료 서비스는 요금이 청구되기 전에 항상 확인을 요청합니다.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"계정마다 하나의 상태 표시등이 있으며, 프로필의 인증 방식에 맞춘 재연결 안내가 함께 제공됩니다\",\"highlight_2\":\"확인을 거친 뒤에만 생성되는 비공개·암호화·버전 관리 저장소\",\"highlight_3\":\"클라우드 아티팩트 라이브러리, 파일, 백업이 모두 사용자가 소유한 하나의 버킷에 저장됩니다\",\"highlight_4\":\"공유 링크는 항상 만료됩니다 — 직접 지정하지 않는 한 어떤 것도 공개되지 않습니다\",\"highlight_5\":\"유료 서비스는 계정마다 첫 사용 전에 확인을 거치며, 모든 변경 사항이 기록으로 남습니다\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Kiro Crew가 접근할 수 있는 모든 AWS 계정과 연결 상태, 이번 달 비용을 AWS 콘솔을 열지 않고 확인합니다.\",\"configuration_1\":\"이 컴퓨터에 이미 있는 프로필에서 계정을 추가하고, 유료 서비스는 처음 사용하기 전에 계정별로 한 번씩 확인합니다.\"},\"console\":{\"copy\":\"복사\",\"copied\":\"복사됨\",\"close\":\"닫기\",\"loading\":\"불러오는 중…\",\"download\":\"다운로드\",\"share\":\"공유\",\"delete\":\"삭제\",\"delete_failed\":\"삭제하지 못했습니다. 파일은 그대로입니다. 다시 시도하세요.\",\"delete_failed_named\":\"‘{{name}}’을(를) 삭제할 수 없습니다. 파일은 변경되지 않았습니다. 다시 시도하세요.\",\"download_failed\":\"다운로드를 시작할 수 없습니다. 아무것도 전송되지 않았습니다. 다시 시도하세요.\",\"delete_confirm_action\":\"파일 삭제\",\"delete_confirm\":\"‘{{name}}’을(를) 삭제하시겠습니까? 파일이 드라이브에서 제거됩니다.\",\"col_name\":\"이름\",\"col_kind\":\"종류\",\"col_size\":\"크기\",\"col_modified\":\"수정일\",\"col_actions\":\"작업\",\"kind_folder\":\"폴더\",\"folder_new\":\"새 폴더\",\"folder_name\":\"폴더 이름\",\"folder_delete_confirm\":\"‘{{name}}’과(와) 그 안의 모든 항목을 삭제하시겠습니까?\",\"folder_delete_action\":\"폴더 삭제\",\"folder_delete_failed\":\"폴더를 삭제할 수 없습니다.\",\"folder_create_failed\":\"폴더를 만들 수 없습니다.\",\"folder_bad_name\":\"이 폴더 이름에는 드라이브가 저장할 수 없는 문자가 있습니다. 문자, 숫자, 공백 및 . _ - ( ) + @ = 는 사용할 수 있습니다.\",\"folder_deleted_other\":\"‘{{name}}’ 삭제됨: {{count}}개 항목.\",\"cancel\":\"취소\",\"load_more\":\"더 보기\",\"stat_this_month\":\"이번 달\",\"storage_consent_needed\":\"이 계정의 클라우드 스토리지가 아직 확인되지 않았습니다. 아래에서 확인한 뒤 새로 고치세요.\",\"stat_stored_value\":\"{{size}} · 항목 {{objects}}개\",\"costs_as_of\":\"{{date}} 기준 캐시된 수치입니다.\",\"costs_consent_missing\":\"이 계정의 지출을 보려면 아래에서 비용 보고를 켜세요.\",\"costs_unavailable\":\"지금은 청구 정보를 읽을 수 없습니다.\",\"account_unavailable\":\"지금은 이 계정에 연결할 수 없습니다. 다시 연결한 뒤 돌아오세요.\",\"drive_status_failed\":\"지금은 드라이브를 읽지 못했습니다.\",\"setup_title\":\"클라우드 드라이브 설정\",\"setup_body\":\"사용자 계정에 파일, 아티팩트 라이브러리, 백업을 위한 비공개·암호화·버전 관리 저장소 버킷 하나를 생성합니다.\",\"setup_searched_region\":\"{{region}}에서 드라이브를 찾지 못했습니다. 이 리전만 검색했으므로 이 계정의 다른 리전에 있는 드라이브는 여기에 표시되지 않습니다.\",\"setup_costs_note\":\"비용은 사용량에 따릅니다. 저장한 만큼 AWS에 요금을 지불하며, 그 전에는 아무 비용도 들지 않습니다.\",\"setup_preview_region\":\"리전\",\"setup_preview_resource\":\"리소스\",\"setup_preview_btn\":\"미리 보기\",\"setup_confirm_btn\":\"생성\",\"setup_creating\":\"생성 중…\",\"setup_error\":\"드라이브를 준비하지 못했습니다. 잠시 후 다시 시도하세요.\",\"setup_confirm_error\":\"드라이브를 만들지 못했습니다. 변경된 내용은 없습니다. 아래 권한을 확인한 뒤 다시 시도하세요.\",\"setup_policy_error\":\"붙여넣을 권한을 불러오지 못했습니다.\",\"setup_policy_label\":\"붙여넣을 정확한 권한 보기\",\"library_all\":\"전체\",\"library_not_pushable\":\"이미지는 아직 클라우드에 복사할 수 없습니다.\",\"kind_widget\":\"위젯\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"텍스트\",\"kind_webapp\":\"웹 앱\",\"kind_image\":\"이미지\",\"drive_title\":\"드라이브\",\"drive_upload\":\"업로드\",\"drive_uploading\":\"업로드 중…\",\"drive_bad_name\":\"이 파일 이름에는 드라이브가 저장할 수 없는 문자가 있습니다. 문자, 숫자, 공백 및 . _ - ( ) + @ = 는 사용할 수 있습니다.\",\"rename_bad_name\":\"이 이름에는 드라이브가 저장할 수 없는 문자가 있습니다. 이름을 수정한 뒤 다시 시도하세요.\",\"drive_bad_name_named\":\"‘{{name}}’을(를) 업로드할 수 없습니다. 이름에 드라이브가 저장할 수 없는 문자가 있습니다. 문자, 숫자, 공백 및 . _ - ( ) + @ = 는 사용할 수 있습니다.\",\"drive_upload_failed\":\"‘{{name}}’ 업로드에 실패했습니다. 다시 시도하세요.\",\"section_files\":\"파일\",\"section_library\":\"아티팩트 라이브러리\",\"section_backup\":\"백업\",\"share_title\":\"‘{{name}}’ 공유\",\"share_expiry\":\"링크 만료 시점\",\"share_note\":\"메모\",\"share_note_placeholder\":\"이 링크는 어떤 용도인가요?\",\"share_create\":\"링크 생성\",\"share_creating\":\"생성 중…\",\"share_failed\":\"공유 링크를 만들지 못했습니다. 아무것도 공유되지 않았습니다.\",\"expiry_1h\":\"1시간\",\"expiry_1d\":\"1일\",\"expiry_7d\":\"7일\",\"share_expires_note\":\"링크는 만료되면 작동을 멈추며, 그 전에 회수할 수 없습니다.\",\"share_credentials_caveat\":\"계정의 로그인 세션이 먼저 끝나면 링크가 더 빨리 작동을 멈출 수 있습니다.\",\"cli_drawer_label\":\"저장 위치\",\"cli_drawer_hint\":\"이 파일들은 버킷 {{bucket}}의 {{prefix}} 아래에 저장됩니다. 이 명령은 자격 증명이 있는 터미널에서 파일 목록을 표시합니다.\",\"backup_title\":\"백업\",\"backup_kind_snapshot\":\"메모리 및 워크스페이스\",\"backup_kind_sessions\":\"세션 아카이브\",\"backup_last_run\":\"마지막 백업 {{when}} · {{size}}\",\"backup_never\":\"아직 백업되지 않음\",\"backup_never_recorded\":\"여기에 기록된 실행이 없습니다 — 이전 아카이브가 아직 드라이브에 남아 있을 수 있습니다\",\"backup_remembered\":\"이 설치가 기록한 아카이브: {{count}} · 목록 보기\",\"backup_sessions_scope\":\"이 Kiro 홈에 있는 모든 세션의 CLI 재생 로그가 포함됩니다. {{productName}}에서 시작한 대화만이 아닙니다.\",\"backup_run_now\":\"지금 백업\",\"backup_running\":\"백업 중…\",\"backup_failed\":\"마지막 백업이 실패했습니다: {{reason}}\",\"backup_start_failed\":\"백업을 시작할 수 없습니다.\",\"backup_start_retry\":\"백업을 시작할 수 없습니다. 다시 시도해 주세요.\",\"backup_start_unavailable\":\"이 앱에서는 백업을 사용할 수 없습니다. 작업 런타임이 등록되어 있는지 확인하세요.\",\"backup_start_consent\":\"이 계정에 S3 액세스를 허용한 후 백업을 시작하세요.\",\"backup_start_no_drive\":\"이 계정에는 아직 드라이브가 없습니다. 드라이브를 만든 후 백업을 시작하세요.\",\"backup_nightly\":\"매일 밤 백업\",\"backup_nightly_hint\":\"메모리 및 워크스페이스 스냅샷을 하루에 한 번 실행합니다.\",\"backup_nightly_blocked_other_account\":\"야간 스냅샷은 기본 계정에 대해서만 실행되므로 이 계정은 아무것도 백업되지 않습니다.\",\"backup_nightly_sessions\":\"매일 밤 세션 백업\",\"backup_nightly_sessions_hint\":\"세션 아카이브를 이 계정의 드라이브에 하루에 한 번 업로드합니다. 대화가 그대로 들어가며 삭제되는 것은 없습니다.\",\"backup_nightly_sessions_destination\":\"그 드라이브는 이 AWS 계정의 S3 스토리지이며, {{button}}도 같은 곳으로 아카이브를 보냅니다.\",\"backup_nightly_sessions_blocked_host\":\"이 컴퓨터에서는 세션 아카이브를 만들 수 없으므로 아무것도 업로드되지 않습니다.\",\"backup_nightly_sessions_blocked_redaction\":\"보내는 데이터 가리기가 켜져 있지만 세션 아카이브는 아직 가릴 수 없으므로 아무것도 업로드되지 않습니다.\",\"backup_nightly_sessions_blocked_other_account\":\"야간 업로드는 기본 계정에 대해서만 실행되므로 이 계정에서는 아무것도 업로드되지 않습니다.\",\"backup_nightly_sessions_blocked_other\":\"이 컴퓨터에서는 야간 업로드가 보류 중이므로 아무것도 업로드되지 않습니다.\",\"backup_nightly_sessions_blocked_next\":\"백업은 직접 시작할 수 있습니다.\",\"backup_nightly_sessions_blocked_next_redaction\":\"백업은 직접 시작할 수 있지만 세션 아카이브는 가려지지 않은 상태로 업로드됩니다.\",\"backup_archive\":\"저장된 백업\",\"backup_restore\":\"복원\",\"backup_show_all_archives\":\"모두 보기({{count}})\",\"backup_restore_caveat\":\"복원에는 백업 폴더에 대한 읽기 권한이 필요합니다. 권장되는 최소 권한 정책은 의도적으로 쓰기 권한만 부여하므로, 계정 자격 증명의 범위가 더 넓지 않으면 거부됩니다.\",\"backup_remote_error\":\"지금은 저장된 백업을 읽지 못했습니다.\",\"backup_status_failed\":\"백업 상태를 읽지 못했습니다.\",\"backup_nightly_failed\":\"‘{{setting}}’ 설정을 변경하지 못했습니다. 설정은 그대로입니다.\",\"backup_restore_failed\":\"해당 백업을 복원하지 못했습니다. 기록된 내용은 없습니다.\",\"backup_restored_note\":\"현재 데이터는 교체되지 않았습니다. 백업은 아래 경로의 스테이징 폴더로 다운로드되었습니다.\",\"backup_restore_recovered_note\":\"이 설치본이 직접 업로드한 사본을 다운로드했고, 기록과 대조해 확인했습니다. 드라이브에서 다른 무언가가 이를 덮어썼으며, 다음 업로드도 같은 방식으로 덮어쓸 수 있습니다. 먼저 이 페이지에 이 드라이브로 백업 중이라고 표시된 다른 설치본부터 확인하세요.\",\"backup_install\":\"이 설치본\",\"backup_install_hint\":\"각 설치본은 자체 이름으로 백업을 저장하므로, 복원 시 이 설치본의 아카이브와 다른 설치본의 아카이브를 구분할 수 있습니다.\",\"backup_install_rename\":\"이름 변경\",\"backup_install_save\":\"이름 저장\",\"backup_install_rename_failed\":\"설치본 이름을 저장하지 못했습니다. 이름은 그대로입니다.\",\"backup_install_name_label\":\"설치본 이름\",\"backup_attribution_self\":\"{{label}} · 이 설치본\",\"backup_attribution_self_unnamed\":\"이 설치본\",\"backup_attribution_other\":\"‘{{label}}’ (다른 설치본 · {{id}})\",\"backup_attribution_other_unnamed\":\"다른 설치본 · {{id}}\",\"backup_attribution_unverified\":\"확인되지 않은 출처\",\"backup_origin_unknown\":\"알 수 없는 출처\",\"backup_none_from_this_install\":\"이 설치본의 백업이 없습니다. 다른 설치본의 아카이브를 포함하면 해당 아카이브를 볼 수 있습니다.\",\"backup_others_on_drive\":\"이 드라이브에 백업하는 다른 설치본: {{count}}\",\"backup_show_others\":\"다른 설치본의 아카이브 포함\",\"backup_others_truncated\":\"처음 {{max}}개의 다른 설치본만 표시됩니다.\",\"backup_archives_truncated\":\"일부 {{kind}} 아카이브를 나열할 수 없습니다. 최신 아카이브가 빠져 있을 수 있습니다.\",\"backup_shared_note\":\"두 설치본이 하나의 드라이브를 공유해도 메모리 공유나 세션 공유가 되는 것은 아닙니다. 각 백업은 한 시점의 개별 아카이브이며, 복원은 해당 파일을 스테이징 폴더로 다운로드할 뿐입니다 — 파일은 gateway를 멈춘 상태에서 직접 교체합니다.\",\"backup_restore_foreign_confirm\":\"이 아카이브는 다른 설치본({{install}})이 업로드했습니다. 복원하면 이 설치본이 아니라 그 설치본의 데이터를 다운로드합니다. 그래도 다운로드하시겠습니까?\",\"backup_restore_unverified_confirm\":\"이 아카이브는 이 설치본 자체 폴더에 저장되어 있지만, 이 설치본에는 업로드한 기록이 없습니다. 드라이브에 쓸 수 있는 누구나 그 폴더를 만들 수 있으므로, 이 설치본의 것이 아닐 수도 있습니다. 그래도 다운로드하시겠습니까?\",\"backup_restore_unknown_confirm\":\"이 아카이브는 설치본에 이름을 붙이기 전에 업로드되어, 어느 설치본이 기록했는지 알 수 없습니다. 그래도 다운로드하시겠습니까?\",\"backup_restore_overwritten_confirm\":\"이 아카이브는 이 설치본이 업로드했지만, 지금 드라이브에 있는 것은 업로드한 내용이 아닙니다. 그 뒤에 다른 무언가가 덮어썼습니다. 그래도 다운로드하시겠습니까?\",\"backup_restore_overwritten_refused\":\"이 아카이브는 이 설치본이 업로드했지만, 지금 드라이브에 있는 것은 업로드한 내용이 아닙니다. 그래도 다운로드하려면 저장된 백업을 열고 다운로드를 선택하세요.\",\"backup_restore_foreign_refused\":\"그 아카이브는 다른 설치본의 것입니다. 그래도 다운로드하려면 복원을 확인하세요.\",\"backup_restore_confirm_yes\":\"다운로드\",\"backup_restore_confirm_no\":\"취소\",\"access_title\":\"공유 링크\",\"access_empty\":\"활성 공유 링크가 없습니다.\",\"access_expires_in\":\"{{when}} 만료\",\"access_forget\":\"목록에서 제거\",\"access_object_missing\":\"파일 삭제됨\",\"access_unchecked\":\"이 링크는 드라이브와 대조하지 않았으므로 삭제된 파일이 여기에 표시되지 않습니다.\",\"access_footer\":\"목록에서 링크를 제거해도 링크가 취소되지 않습니다. 공유된 링크는 만료될 때까지 계속 작동합니다.\",\"access_list_failed\":\"공유 링크를 읽지 못했습니다.\",\"access_forget_failed\":\"해당 링크를 목록에서 제거하지 못했습니다. 아직 목록에 있습니다.\",\"keys_count_other\":\"키 {{count}}개\",\"keys_for_account\":\"{{name}}의 키\",\"key_healthy\":\"정상\",\"parent_folders\":\"상위 폴더\",\"folder_actions\":\"폴더 작업\",\"file_actions\":\"파일 작업\",\"root_storage_used\":\"저장소 사용 내역\",\"root_section_objects_other\":\"{{objects}}개\",\"view_grid\":\"그리드 보기\",\"view_list\":\"목록 보기\",\"library_add\":\"아티팩트에서 추가\",\"library_add_one\":\"‘아티팩트 라이브러리’에 추가\",\"folder_open\":\"{{name}} 폴더 열기\",\"library_adding\":\"추가 중…\",\"library_add_oneway\":\"여기에 만든 사본은 클라우드 용량을 사용합니다.\",\"library_add_again\":\"다시 추가\",\"library_add_count\":\"아티팩트에서 추가({{count}}개 준비됨)\",\"library_add_nothing\":\"추가할 것이 더 없습니다.\",\"library_list_failed\":\"클라우드의 내용을 읽지 못했습니다.\",\"files_list_failed\":\"이 폴더를 읽지 못했습니다.\",\"library_local_failed\":\"아티팩트를 읽을 수 없습니다.\",\"retry\":\"다시 시도\",\"library_add_none\":\"일치하는 아티팩트가 없습니다.\",\"library_update\":\"사본 업데이트\",\"library_search\":\"아티팩트 검색\",\"library_push_failed\":\"이 아티팩트를 추가하지 못했습니다. 다시 시도하세요.\",\"library_blurb\":\"Kiro가 만들어 준 항목을 클라우드에 복사한 것입니다. 직접 업로드한 파일은 ‘파일’에 있습니다.\",\"library_empty_title\":\"아직 클라우드에 복사된 항목이 없습니다\",\"library_empty_body\":\"이 폴더에는 Kiro가 만들어 준 항목(위젯, 페이지, 문서)을 클라우드에 복사하면 담깁니다. 컴퓨터에서 업로드한 파일은 대신 ‘파일’에 넣으세요.\",\"library_cloud_only\":\"클라우드에만 있음\",\"library_in_cloud\":\"클라우드에 있음\",\"library_stale_preview\":\"클라우드 사본은 v{{version}}입니다. 미리 보기는 더 새로운 로컬 사본입니다\",\"library_stale_list\":\"클라우드 사본은 v{{version}}이며, 로앴 사본이 더 새로울니다\",\"library_added\":\"{{when}} 추가됨\",\"library_open\":\"아티팩트에서 {{name}} 열기\",\"files_empty_title\":\"‘파일’이 비어 있습니다\",\"files_empty_body\":\"이 폴더에는 컴퓨터에서 업로드한 파일이 있습니다. Kiro가 만들어 준 항목이 있는 ‘아티팩트 라이브러리’와는 별개입니다.\",\"library_remove\":\"제거\",\"library_remove_confirm\":\"‘{{name}}’을(를) 클라우드 라이브러리에서 제거하시겠습니까?\",\"library_remove_confirm_slug\":\"이 작업은 클라우드 폴더 <folder>{{folder}}</folder>를 비웁니다.\",\"library_actions\":\"라이브러리 항목 작업\",\"library_remove_action\":\"사본 제거\",\"library_removing\":\"제거 중…\",\"library_remove_failed\":\"제거하지 못했습니다. 클라우드 사본은 그대로입니다. 다시 시도하세요.\",\"move_conflict\":\"대상 폴더에 같은 이름의 파일이 이미 있습니다. 다른 폴더를 선택하거나 먼저 파일 이름을 바꾸세요.\",\"move_shared\":\"이 파일에는 유효한 공유 링크가 있습니다. 이동하면 링크가 끓어집니다. 공유를 제거하거나 만료될 때까지 기다린 뒤 다시 시도하세요.\",\"rename\":\"이름 바꾸기\",\"preview_truncated\":\"파일이 커서 앞부분만 표시합니다.\",\"preview_redacted\":\"이 미리보기에서는 민감한 값이 마스킹되어 있습니다.\",\"preview_unsupported\":\"이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드해서 확인하세요.\",\"preview_failed\":\"미리보기를 불러오지 못했습니다. 다운로드해서 확인하거나 다시 시도하세요.\",\"search_files\":\"파일 이름 또는 경로로 검색…\",\"search_clear\":\"검색 지우기\",\"search_pending\":\"검색 중…\",\"search_capped\":\"일치 항목이 너무 많아 첫 {{count}}개만 표시합니다.\",\"search_failed\":\"검색에 실패했습니다. 다시 시도하세요.\",\"search_goto\":\"포함 폴더 열기\",\"move_failed\":\"파일을 이동하지 못했습니다. 다시 시도하세요.\",\"rename_conflict\":\"같은 이름의 파일이 이미 여기에 있습니다.\",\"rename_shared\":\"이 파일에는 유효한 공유 링크가 있습니다. 이름을 바꾸면 링크가 끊어집니다. 공유를 제거하거나 만료될 때까지 기다린 뒤 다시 시도하세요.\",\"rename_failed\":\"파일 이름을 바꾸지 못했습니다. 다시 시도하세요.\",\"rename_failed_named\":\"‘{{name}}’의 이름을 바꿀 수 없습니다: {{reason}}\",\"library_add_empty\":\"아직 아티팩트가 없습니다. Kiro가 만들어 준 항목이 여기에 표시되며, 클라우드로 복사할 수 있습니다.\",\"move_to\":\"폴더로 이동…\",\"move_title\":\"‘{{name}}’ 이동 위치\",\"move_root\":\"파일(최상위)\",\"move_up\":\"상위 {{name}}(으)로\",\"move_no_folders\":\"여기에는 이동할 다른 폴더가 없습니다. 먼저 폴더를 만드세요.\",\"move_moving\":\"이동 중…\",\"move_moving_picker\":\"이동 중… 이 창을 닫아도 이동은 취소되지 않습니다.\",\"move_to_busy\":\"다른 이동이 아직 진행 중입니다\",\"move_ask_agent\":\"이 이동에 대해 에이전트에게 질문\",\"stat_storage\":\"스토리지\",\"stat_objects\":\"객체\",\"key_needs_attention\":\"확인 필요\",\"backup_state_current\":\"백업됨\",\"backup_state_never\":\"실행 안 됨\",\"costs_refresh_failed\":\"최신 청구액 읽기에 실패했습니다. 표시된 값은 캐시된 수치입니다.\"},\"page\":{\"refresh\":\"새로 고침\",\"health_ok\":\"정상\",\"health_degraded\":\"확인 필요\",\"health_unknown\":\"알 수 없음\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"자격 증명 프로세스\",\"kind_other\":\"기타\",\"default_profile\":\"기본 프로필\",\"not_connected_yet\":\"아직 연결되지 않음\",\"reconnect\":\"다시 연결\",\"reconnect_loading\":\"다시 연결 안내를 불러오는 중…\",\"reconnect_error\":\"다시 연결 안내를 불러오지 못했습니다.\",\"reconnect_hint_sso\":\"다시 로그인해 이 연결을 갱신한 다음 이 페이지를 새로 고치세요.\",\"reconnect_hint_credential_process\":\"터미널에서 이 명령을 실행해 자격 증명을 갱신한 다음 이 페이지를 새로 고치세요.\",\"reconnect_hint_other\":\"터미널에서 이 명령을 실행해 연결을 복구한 다음 이 페이지를 새로 고치세요.\",\"copy\":\"복사\",\"copied\":\"복사됨\",\"empty_title\":\"아직 계정이 없습니다\",\"empty_body\":\"아래 계정 추가에서 이 컴퓨터의 AWS 프로필을 등록하면 해당 계정이 여기에 표시됩니다.\",\"error_title\":\"계정을 불러오지 못했습니다.\",\"error_body\":\"계정 목록을 읽는 중 문제가 발생했습니다. 잠시 후 다시 시도하세요.\",\"error_forbidden_body\":\"이 대시보드 세션은 소유자의 세션이 아니므로 AWS 계정을 관리할 수 없습니다. 소유자로 로그인한 뒤 다시 시도하세요.\",\"retry\":\"다시 시도\",\"disabled_title\":\"AWS Control이 꺼져 있습니다\",\"disabled_body\":\"계정을 보려면 App Store에서 이 앱을 활성화하세요.\",\"aggregate_accounts_other\":\"계정 {{count}}개\",\"aggregate_keys_other\":\"키 {{count}}개\",\"aggregate_healthy_other\":\"정상 {{count}}개\",\"keys_summary_other\":\"키 {{count}}개\",\"add_accounts_title\":\"계정 추가\",\"add_accounts_summary\":\"이 컴퓨터의 AWS 프로필을 더 등록\",\"add_accounts_intro\":\"이 로컬 AWS 프로필은 아직 등록되지 않았습니다. 추가하는 각 프로필은 해당 계정의 키가 됩니다.\",\"add_accounts_search_placeholder\":\"프로필 검색\",\"add_accounts_search_keeps_selected\":\"선택한 프로필은 검색어와 일치하지 않아도 목록에 남습니다.\",\"add_accounts_none\":\"모든 로컬 프로필이 이미 등록되어 있습니다.\",\"add_accounts_no_profiles\":\"이 컴퓨터에는 아직 AWS 프로필이 없습니다. 먼저 프로필을 만든 뒤(예: 터미널에서 aws configure 실행) 여기에서 등록하세요.\",\"add_accounts_unsupported\":\"Windows에서는 AWS Control이 이 컴퓨터의 AWS 프로필에 접근할 수 없습니다. AWS 접근에는 Linux 또는 macOS 쉘이 필요합니다. WSL (Windows Subsystem for Linux)에서 {{productName}} 게이트웨이를 실행한 뒤 그곳에서 설정한 프로필을 등록하세요.\",\"add_accounts_count_other\":\"{{max}}개 중 {{count}}개 등록됨\",\"add_accounts_cap_reached\":\"키 {{max}}개 한도에 도달했습니다. 더 추가하려면 먼저 하나를 제거하세요.\",\"add_accounts_register\":\"선택한 항목 등록\",\"add_accounts_registering\":\"등록 중…\",\"add_accounts_error\":\"해당 프로필을 등록할 수 없습니다. 아무것도 추가되지 않았습니다. 다시 시도하세요.\",\"add_accounts_load_error\":\"로컬 AWS 프로필을 나열하지 못했습니다.\",\"search_placeholder\":\"계정 검색\",\"paid_services_title\":\"유료 서비스\",\"orphan_consent\":\"여기에 등록되지 않은 AWS 계정에 대해 확인되었습니다. 아래에서 확인을 철회하거나, 해당 계정을 다시 등록해 전용 페이지에서 관리하세요.\",\"account_actions\":\"계정 작업\",\"remove_account\":\"AWS Control에서 제거…\",\"remove_account_action\":\"제거\",\"remove_account_confirm\":\"‘{{name}}’을(를) AWS Control에서 제거하시겠습니까? AWS나 AWS CLI 구성은 아무것도 바뀌지 않습니다.\",\"remove_account_error\":\"계정을 제거할 수 없습니다.\",\"remove_account_hint\":\"AWS에서는 아무것도 바뀌지 않습니다\",\"forget_key_confirm\":\"이 행의 키 ‘{{name}}’을(를) 잊으시겠습니까? AWS나 AWS CLI 구성은 아무것도 바뀌지 않습니다.\",\"forget_key_action\":\"키 잊기\",\"totals_summary_other\":\"계정 {{accounts}}개 · {{keys}}\",\"keys_healthy_other\":\"키 {{n}}개 중 {{healthy}}개 정상\"},\"rail\":{\"accounts\":\"계정 및 자격 증명\",\"nav\":\"AWS Control 섹션\",\"switch_account\":\"계정 전환\",\"usage\":\"사용량 및 비용\",\"use_account\":\"이 계정 사용\"},\"overview\":{\"title\":\"개요\",\"subtitle\":\"에이전트가 사용할 수 있는 계정, 키, 클라우드 드라이브, 유료 서비스를 한곳에서 관리합니다.\",\"stat_accounts\":\"계정\",\"stat_accounts_attention_other\":\"{{count}}개 확인 필요\",\"stat_accounts_all_ok\":\"모두 정상\",\"stat_keys\":\"키 정상\",\"stat_keys_sub_other\":\"키 {{count}}개 등록됨\",\"stat_drive\":\"드라이브 사용량\",\"stat_drive_none\":\"드라이브 없음\",\"stat_spend\":\"이번 달 누적\",\"stat_spend_consent\":\"비용 보고 꺼짐\",\"stat_shares_none\":\"공유 없음\",\"stat_shares_sub_other\":\"활성 링크 {{count}}개\",\"stat_backups_nightly\":\"매일 밤\",\"stat_backups_manual\":\"수동\",\"stat_backups_sub_nightly\":\"매일 밤 실행\",\"stat_backups_sub_manual\":\"일정 없음\",\"accounts_title\":\"계정\",\"accounts_note\":\"에이전트는 이 키를 사용하지만 키 자체를 보지는 않습니다. 키의 내용은 채팅에 나타나지 않습니다.\",\"add_account\":\"계정 추가\",\"drive_title\":\"클라우드 드라이브\",\"drive_bar_label\":\"{{size}} 저장됨. 파일, 아티팩트 라이브러리, 백업에 나뉘어 있습니다.\",\"drive_empty_title\":\"클라우드 드라이브 없음\",\"drive_empty_body\":\"이 계정에 비공개 암호화 버킷 하나를 만들어 파일, 아티팩트 라이브러리, 백업을 저장하세요.\",\"drive_setup\":\"클라우드 드라이브 설정\",\"drive_bucket_label\":\"버킷\",\"stat_spend_scope\":\"이 계정의 AWS 청구액\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "첫 요청 전에 AWS 사용 확인",
				"confirmed_title": "AWS 사용이 확인됨",
				"account_changed": "이전에는 다른 AWS 계정으로 확인되었기 때문에 확인이 취소되었습니다. 아래 계정을 검토한 후 다시 확인하세요.",
				"service": "서비스",
				"region": "리전",
				"credential_source": "자격 증명 출처",
				"aws_account": "AWS 계정",
				"provider_default": "(공급자 기본값)",
				"unresolved_account": "확인할 수 없음",
				"billing_notice": "유료 AWS 서비스입니다. 확인하기 전에는 요청이 전송되지 않습니다.",
				"confirm_button": "확인하고 사용",
				"withdraw": "확인 취소",
				"status_failed": "확인 상태를 읽지 못했습니다.",
				"confirm_failed": "확인이 기록되지 않았습니다.",
				"withdraw_failed": "확인이 취소되지 않았습니다.",
				"retry": "다시 시도",
				"badge_confirmed": "확인됨",
				"badge_not_enabled": "사용 안 함",
				"confirmed_on": "{{date}}에 확인됨",
				"billing_notice_short": "요금이 발생합니다. 확인하기 전에는 아무것도 전송되지 않습니다.",
				"pending_profile_hint": "AWS 프로필 입력을 마치면 확인할 수 있어요.",
				"bedrock_kb_billing_short": "검색마다 청구: Knowledge Base당 Bedrock Retrieve 호출 1회",
				"aws_pricing_link": "AWS 요금",
				"withdraw_effect": "철회하면 다시 확인할 때까지 에이전트가 이 서비스를 사용하지 않습니다."
			},
			"ui": {
				"clear_filter": "필터 지우기",
				"no_matches_for": "일치하는 항목 없음:",
				"no_noun_match": "일치하는 {{noun}} 없음"
			}
		}
	},
	pt: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"Suas contas de nuvem, em linguagem simples. Veja cada conta AWS que o Kiro Crew pode usar, com um indicador de saúde por conta e orientações de reconexão adequadas, além de um drive de nuvem apoiado no S3 — arquivos, uma biblioteca de artefatos na nuvem e backups — com links de compartilhamento por tempo limitado. Nada é público a menos que você decida, e todo serviço pago pede sua confirmação antes de poder cobrar.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"Um indicador de saúde por conta, cada um com orientações de reconexão adequadas à forma como o perfil se autentica\",\"highlight_2\":\"Armazenamento privado, criptografado e versionado, criado somente depois que você confirmar\",\"highlight_3\":\"Sua biblioteca de artefatos na nuvem, arquivos e backups ficam todos em um único bucket que é seu\",\"highlight_4\":\"Links de compartilhamento sempre expiram — nada é público a menos que você decida\",\"highlight_5\":\"Todo serviço pago é confirmado por conta antes do primeiro uso, e toda alteração fica registrada\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Veja cada conta AWS que o Kiro Crew consegue alcançar, quais estão saudáveis e quanto este mês está a custar, sem abrir a consola da AWS.\",\"configuration_1\":\"Adicione uma conta a partir dos perfis que já existem nesta máquina e confirme cada serviço pago uma vez por conta antes da primeira utilização.\"},\"console\":{\"copy\":\"Copiar\",\"copied\":\"Copiado\",\"close\":\"Fechar\",\"loading\":\"Carregando…\",\"download\":\"Baixar\",\"share\":\"Compartilhar\",\"delete\":\"Excluir\",\"delete_failed\":\"Falha ao excluir — o arquivo está inalterado. Tente novamente.\",\"delete_failed_named\":\"Não foi possível excluir “{{name}}” — o arquivo não foi alterado. Tente novamente.\",\"download_failed\":\"Não foi possível iniciar o download. Nada foi enviado. Tente novamente.\",\"delete_confirm_action\":\"Excluir arquivo\",\"delete_confirm\":\"Excluir “{{name}}”? O arquivo é removido do drive.\",\"col_name\":\"Nome\",\"col_kind\":\"Tipo\",\"col_size\":\"Tamanho\",\"col_modified\":\"Modificado\",\"col_actions\":\"Ações\",\"kind_folder\":\"Pasta\",\"folder_new\":\"Nova pasta\",\"folder_name\":\"Nome da pasta\",\"folder_delete_confirm\":\"Excluir “{{name}}” e tudo o que há nela?\",\"folder_delete_action\":\"Excluir pasta\",\"folder_delete_failed\":\"Não foi possível excluir a pasta.\",\"folder_create_failed\":\"Não foi possível criar a pasta.\",\"folder_bad_name\":\"Esse nome de pasta tem caracteres que o drive não consegue armazenar. Letras, dígitos, espaços e . _ - ( ) + @ = são seguros.\",\"folder_deleted_one\":\"“{{name}}” excluído: {{count}} item.\",\"folder_deleted_other\":\"“{{name}}” excluído: {{count}} itens.\",\"folder_deleted_many\":\"“{{name}}” excluído: {{count}} itens.\",\"cancel\":\"Cancelar\",\"load_more\":\"Carregar mais\",\"stat_this_month\":\"Este mês\",\"storage_consent_needed\":\"O armazenamento na nuvem desta conta ainda não foi confirmado. Confirme abaixo e depois atualize a página.\",\"stat_stored_value\":\"{{size}} · {{objects}} itens\",\"costs_as_of\":\"Valores em cache, referentes a {{date}}.\",\"costs_consent_missing\":\"Ative o relatório de custos abaixo para ver os gastos desta conta.\",\"costs_unavailable\":\"Não foi possível ler a fatura agora.\",\"account_unavailable\":\"Não é possível acessar esta conta agora. Reconecte-a e volte depois.\",\"drive_status_failed\":\"Não foi possível ler o drive agora.\",\"setup_title\":\"Configurar um drive de nuvem\",\"setup_body\":\"Isto cria um bucket de armazenamento privado, criptografado e versionado na sua própria conta, para seus arquivos, biblioteca de artefatos e backups.\",\"setup_searched_region\":\"Nenhum drive encontrado em {{region}}. Só esta região foi pesquisada, então um drive em outra região desta conta não aparecerá aqui.\",\"setup_costs_note\":\"Os custos acompanham o uso: você paga à AWS pelo que armazena, e nada antes disso.\",\"setup_preview_region\":\"Região\",\"setup_preview_resource\":\"Recurso\",\"setup_preview_btn\":\"Prévia\",\"setup_confirm_btn\":\"Criar\",\"setup_creating\":\"Criando…\",\"setup_error\":\"Não foi possível preparar o drive. Tente novamente em instantes.\",\"setup_confirm_error\":\"Não foi possível criar o drive. Nada foi alterado. Verifique as permissões abaixo e tente novamente.\",\"setup_policy_error\":\"Não foi possível carregar as permissões para colar.\",\"setup_policy_label\":\"Mostrar as permissões exatas para colar\",\"library_all\":\"Todos\",\"library_not_pushable\":\"As imagens ainda não podem ser copiadas para a nuvem.\",\"kind_widget\":\"Widget\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Texto\",\"kind_webapp\":\"Aplicativo web\",\"kind_image\":\"Imagem\",\"drive_title\":\"Drive\",\"drive_upload\":\"Enviar\",\"drive_uploading\":\"Enviando…\",\"drive_bad_name\":\"Esse nome de arquivo tem caracteres que o drive não consegue armazenar. Letras, dígitos, espaços e . _ - ( ) + @ = são seguros.\",\"rename_bad_name\":\"Esse nome tem caracteres que o drive não consegue armazenar. Altere o nome e tente novamente.\",\"drive_bad_name_named\":\"Não é possível enviar “{{name}}” — o nome tem caracteres que o drive não consegue armazenar. Letras, dígitos, espaços e . _ - ( ) + @ = são seguros.\",\"drive_upload_failed\":\"Não foi possível enviar “{{name}}”. Tente novamente.\",\"section_files\":\"Arquivos\",\"section_library\":\"Biblioteca de artefatos\",\"section_backup\":\"Backup\",\"share_title\":\"Compartilhar “{{name}}”\",\"share_expiry\":\"O link expira após\",\"share_note\":\"Nota\",\"share_note_placeholder\":\"Para que serve este link?\",\"share_create\":\"Criar link\",\"share_creating\":\"Criando…\",\"share_failed\":\"Não foi possível criar o link de compartilhamento. Nada foi compartilhado.\",\"expiry_1h\":\"1 hora\",\"expiry_1d\":\"1 dia\",\"expiry_7d\":\"7 dias\",\"share_expires_note\":\"O link para de funcionar quando expira e não pode ser revogado antes disso.\",\"share_credentials_caveat\":\"Pode parar de funcionar antes se a sessão de login da conta terminar primeiro.\",\"cli_drawer_label\":\"Onde isto fica\",\"cli_drawer_hint\":\"Estes arquivos ficam em {{prefix}} no bucket {{bucket}}. Este comando os lista a partir de um terminal que tenha suas credenciais.\",\"backup_title\":\"Backup\",\"backup_kind_snapshot\":\"Memória e espaço de trabalho\",\"backup_kind_sessions\":\"Arquivo de sessões\",\"backup_last_run\":\"Último backup {{when}} · {{size}}\",\"backup_never\":\"Ainda sem backup\",\"backup_never_recorded\":\"Nenhuma execução registrada aqui — arquivos anteriores ainda podem estar na unidade\",\"backup_remembered\":\"Arquivos registrados por esta instalação: {{count}} · ver a lista\",\"backup_sessions_scope\":\"Inclui os registros de reprodução da CLI de todas as sessões nesta pasta do Kiro, não apenas das conversas iniciadas no {{productName}}.\",\"backup_run_now\":\"Fazer backup agora\",\"backup_running\":\"Fazendo backup…\",\"backup_failed\":\"O último backup falhou: {{reason}}\",\"backup_start_failed\":\"Não foi possível iniciar o backup.\",\"backup_start_retry\":\"Não foi possível iniciar o backup. Tente novamente.\",\"backup_start_unavailable\":\"Os backups não estão disponíveis para este aplicativo. Verifique se o runtime de tarefas está registrado.\",\"backup_start_consent\":\"Conceda acesso ao S3 para esta conta e inicie o backup.\",\"backup_start_no_drive\":\"Esta conta ainda não tem drive. Crie um e inicie o backup.\",\"backup_nightly\":\"Fazer backup toda noite\",\"backup_nightly_hint\":\"Executa um snapshot de memória e espaço de trabalho uma vez por dia.\",\"backup_nightly_blocked_other_account\":\"Os instantâneos noturnos são executados apenas para a conta padrão, portanto nada é copiado desta conta.\",\"backup_nightly_sessions\":\"Fazer backup das sessões todas as noites\",\"backup_nightly_sessions_hint\":\"Envia o arquivo de sessões para o drive desta conta uma vez por dia. Ele contém suas conversas como estão, sem remover nada.\",\"backup_nightly_sessions_destination\":\"Esse drive é armazenamento S3 nesta conta da AWS, e {{button}} envia o arquivo para o mesmo lugar.\",\"backup_nightly_sessions_blocked_host\":\"Este computador não consegue criar o arquivo de sessões, portanto nada é enviado.\",\"backup_nightly_sessions_blocked_redaction\":\"A ocultação de dados enviados está ativada e o arquivo de sessões ainda não pode ser ocultado, portanto nada é enviado.\",\"backup_nightly_sessions_blocked_other_account\":\"Os envios noturnos são executados apenas para a conta padrão, portanto nada é enviado desta conta.\",\"backup_nightly_sessions_blocked_other\":\"Os envios noturnos estão suspensos neste computador, portanto nada é enviado.\",\"backup_nightly_sessions_blocked_next\":\"Você ainda pode iniciar o backup manualmente.\",\"backup_nightly_sessions_blocked_next_redaction\":\"Você ainda pode iniciar o backup manualmente, mas o arquivo de sessões é enviado sem ocultação.\",\"backup_archive\":\"Backups armazenados\",\"backup_restore\":\"Restaurar\",\"backup_show_all_archives\":\"Mostrar tudo ({{count}})\",\"backup_restore_caveat\":\"A restauração precisa de acesso de leitura à pasta de backups. A política de privilégio mínimo recomendada concede deliberadamente apenas escrita, portanto será negada a menos que as credenciais da conta sejam mais amplas.\",\"backup_remote_error\":\"Não foi possível ler os backups armazenados agora.\",\"backup_status_failed\":\"Não foi possível ler o status do backup.\",\"backup_nightly_failed\":\"Não foi possível alterar “{{setting}}”. Ela permanece inalterada.\",\"backup_restore_failed\":\"Não foi possível restaurar esse backup. Nada foi gravado.\",\"backup_restored_note\":\"Seus dados atuais não foram substituídos. O backup foi baixado para uma pasta de preparação no caminho abaixo.\",\"backup_restore_recovered_note\":\"O envio desta própria instalação foi baixado e conferido com o que ela registrou. Outra coisa o havia sobrescrito no drive e pode fazer o mesmo com seu próximo envio. Comece pelas outras instalações que esta página lista fazendo backup neste drive.\",\"backup_install\":\"Esta instalação\",\"backup_install_hint\":\"Cada instalação guarda seus backups com um nome próprio, para que uma restauração consiga distinguir os arquivos desta instalação dos de outra instalação.\",\"backup_install_rename\":\"Renomear\",\"backup_install_save\":\"Salvar nome\",\"backup_install_rename_failed\":\"Não foi possível salvar o nome da instalação. Ele permanece inalterado.\",\"backup_install_name_label\":\"Nome da instalação\",\"backup_attribution_self\":\"{{label}} · esta instalação\",\"backup_attribution_self_unnamed\":\"esta instalação\",\"backup_attribution_other\":\"\\\"{{label}}\\\" (outra instalação · {{id}})\",\"backup_attribution_other_unnamed\":\"outra instalação · {{id}}\",\"backup_attribution_unverified\":\"origem não verificada\",\"backup_origin_unknown\":\"origem desconhecida\",\"backup_none_from_this_install\":\"Nenhum backup desta instalação. Inclua os arquivos de outras instalações para ver os delas.\",\"backup_others_on_drive\":\"Outras instalações que fazem backup neste drive: {{count}}\",\"backup_show_others\":\"Incluir arquivos de outras instalações\",\"backup_others_truncated\":\"Apenas as primeiras {{max}} outras instalações são mostradas.\",\"backup_archives_truncated\":\"Não foi possível listar alguns arquivos de {{kind}}. Os mais recentes podem estar faltando.\",\"backup_shared_note\":\"Um drive compartilhado por duas instalações não é memória compartilhada nem sessões compartilhadas. Cada backup é um arquivo separado de um momento, e uma restauração apenas baixa esse arquivo para uma pasta de preparação — os arquivos você mesmo substitui, com o gateway parado.\",\"backup_restore_foreign_confirm\":\"Este arquivo foi enviado por outra instalação ({{install}}). Restaurá-lo baixa os dados daquela instalação, não os desta instalação. Baixar mesmo assim?\",\"backup_restore_unverified_confirm\":\"Este arquivo está guardado na pasta própria desta instalação, mas esta instalação não tem registro de tê-lo enviado. Qualquer um que possa escrever no drive pode criar essa pasta, então talvez ele não seja desta instalação. Baixar mesmo assim?\",\"backup_restore_unknown_confirm\":\"Este arquivo foi enviado antes de as instalações terem nome, então não se sabe qual instalação o escreveu. Baixar mesmo assim?\",\"backup_restore_overwritten_confirm\":\"Esta instalação enviou este arquivo, mas o drive já não contém o que ela enviou — outra coisa o sobrescreveu desde então. Baixar mesmo assim?\",\"backup_restore_overwritten_refused\":\"Esta instalação enviou este arquivo, mas o drive já não contém o que ela enviou. Para baixá-lo mesmo assim, abra Backups armazenados e escolha Baixar.\",\"backup_restore_foreign_refused\":\"Esse arquivo pertence a outra instalação. Confirme a restauração para baixá-lo mesmo assim.\",\"backup_restore_confirm_yes\":\"Baixar\",\"backup_restore_confirm_no\":\"Cancelar\",\"access_title\":\"Links de compartilhamento\",\"access_empty\":\"Nenhum link de compartilhamento ativo.\",\"access_expires_in\":\"expira {{when}}\",\"access_forget\":\"Remover da lista\",\"access_object_missing\":\"Arquivo excluído\",\"access_unchecked\":\"Estes links não foram verificados no drive, então um arquivo excluído não é sinalizado aqui.\",\"access_footer\":\"Remover um link da lista não o revoga — um link compartilhado continua funcionando até expirar.\",\"access_list_failed\":\"Não foi possível ler os links de compartilhamento.\",\"access_forget_failed\":\"Não foi possível remover esse link da lista. Ele continua listado.\",\"keys_count_one\":\"{{count}} chave\",\"keys_count_other\":\"{{count}} chaves\",\"keys_count_many\":\"{{count}} chaves\",\"keys_for_account\":\"Chaves de {{name}}\",\"key_healthy\":\"Íntegra\",\"parent_folders\":\"Pastas superiores\",\"folder_actions\":\"Ações da pasta\",\"file_actions\":\"Ações do arquivo\",\"root_storage_used\":\"O que ocupa o armazenamento\",\"root_section_objects_one\":\"{{objects}} item\",\"root_section_objects_other\":\"{{objects}} itens\",\"root_section_objects_many\":\"{{objects}} itens\",\"view_grid\":\"Exibição em grade\",\"view_list\":\"Exibição em lista\",\"library_add\":\"Adicionar dos Artefatos\",\"library_add_one\":\"Adicionar à Biblioteca de artefatos\",\"folder_open\":\"Abrir a pasta {{name}}\",\"library_adding\":\"A adicionar…\",\"library_add_oneway\":\"As cópias ocupam armazenamento na nuvem.\",\"library_add_again\":\"Adicionar de novo\",\"library_add_count\":\"Adicionar dos Artefatos ({{count}} prontos)\",\"library_add_nothing\":\"Nada mais a adicionar: tudo o que pode estar já está aqui.\",\"library_list_failed\":\"Não foi possível ler o conteúdo na nuvem.\",\"files_list_failed\":\"Não foi possível ler esta pasta.\",\"library_local_failed\":\"Não foi possível ler seus artefatos.\",\"retry\":\"Tentar novamente\",\"library_add_none\":\"Nenhum artefato corresponde.\",\"library_update\":\"Atualizar cópia\",\"library_search\":\"Pesquisar seus artefatos\",\"library_push_failed\":\"Não foi possível adicionar este artefato. Tente novamente.\",\"library_blurb\":\"Coisas que o Kiro criou para você, copiadas para a nuvem. Arquivos que você mesmo envia ficam em Arquivos.\",\"library_empty_title\":\"Nada copiado para a nuvem ainda\",\"library_empty_body\":\"Esta pasta guarda coisas que o Kiro criou para você — widgets, páginas, documentos — depois que você as copia para a nuvem. Arquivos enviados do seu computador vão para Arquivos.\",\"library_cloud_only\":\"Somente na nuvem\",\"library_in_cloud\":\"Na nuvem\",\"library_stale_preview\":\"A cópia na nuvem é v{{version}}; a pré-visualização mostra a sua cópia local mais recente\",\"library_stale_list\":\"A cópia na nuvem é v{{version}}; sua cópia local é mais recente\",\"library_added\":\"Adicionado {{when}}\",\"library_open\":\"Abrir {{name}} em Artefatos\",\"files_empty_title\":\"Arquivos está vazio\",\"files_empty_body\":\"Esta pasta guarda arquivos que você envia do seu computador. É separada de Biblioteca de artefatos, que guarda as coisas que o Kiro criou para você.\",\"library_remove\":\"Remover\",\"library_remove_confirm\":\"Remover “{{name}}” da biblioteca na nuvem?\",\"library_remove_confirm_slug\":\"Isto esvazia a pasta na nuvem <folder>{{folder}}</folder>.\",\"library_actions\":\"Ações do item da biblioteca\",\"library_remove_action\":\"Remover a cópia\",\"library_removing\":\"A remover…\",\"library_remove_failed\":\"Falha ao remover — a cópia na nuvem está inalterada. Tente novamente.\",\"move_conflict\":\"A pasta de destino já tem um arquivo com este nome. Escolha outra pasta ou renomeie o arquivo primeiro.\",\"move_shared\":\"Este arquivo tem um link de compartilhamento ativo — movê-lo quebraria o link. Remova o compartilhamento (ou deixe-o expirar) e tente novamente.\",\"rename\":\"Renomear\",\"preview_truncated\":\"Arquivo grande — mostrando apenas o início.\",\"preview_redacted\":\"Valores sensíveis estão mascarados nesta pré-visualização.\",\"preview_unsupported\":\"Este tipo de arquivo não pode ser visualizado. Baixe-o para ver.\",\"preview_failed\":\"Falha ao carregar a prévia. Baixe o arquivo para vê-lo ou tente novamente.\",\"search_files\":\"Pesquisar por nome de arquivo ou caminho…\",\"search_clear\":\"Limpar pesquisa\",\"search_pending\":\"Pesquisando…\",\"search_capped\":\"Muitos resultados — mostrando os primeiros {{count}}.\",\"search_failed\":\"A pesquisa falhou. Tente novamente.\",\"search_goto\":\"Abrir pasta contêiner\",\"move_failed\":\"Não foi possível mover o arquivo. Tente novamente.\",\"rename_conflict\":\"Já existe um arquivo com este nome aqui.\",\"rename_shared\":\"Este arquivo tem um link de compartilhamento ativo — renomeá-lo quebraria o link. Remova o compartilhamento (ou deixe-o expirar) e tente novamente.\",\"rename_failed\":\"Não foi possível renomear o arquivo. Tente novamente.\",\"rename_failed_named\":\"Não foi possível renomear “{{name}}”: {{reason}}\",\"library_add_empty\":\"Ainda não há artefatos. O que o Kiro criar para você aparecerá aqui, pronto para copiar para a nuvem.\",\"move_to\":\"Mover para a pasta…\",\"move_title\":\"Mover “{{name}}” para\",\"move_root\":\"Arquivos (nível superior)\",\"move_up\":\"Subir para {{name}}\",\"move_no_folders\":\"Não há outra pasta aqui para onde movê-lo. Crie uma primeiro.\",\"move_moving\":\"Movendo…\",\"move_moving_picker\":\"Movendo… Fechar isto não cancela a movimentação.\",\"move_to_busy\":\"Outra movimentação ainda está em andamento\",\"move_ask_agent\":\"Perguntar ao agente sobre esta movimentação\",\"stat_storage\":\"Armazenamento\",\"stat_objects\":\"Objetos\",\"key_needs_attention\":\"Precisa de atenção\",\"backup_state_current\":\"Com backup\",\"backup_state_never\":\"Nunca executado\",\"costs_refresh_failed\":\"A última leitura da fatura falhou. Este é o valor em cache.\"},\"page\":{\"refresh\":\"Atualizar\",\"health_ok\":\"Íntegro\",\"health_degraded\":\"Requer atenção\",\"health_unknown\":\"Desconhecido\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Processo de credenciais\",\"kind_other\":\"Outro\",\"default_profile\":\"Perfil padrão\",\"not_connected_yet\":\"Ainda não conectado\",\"reconnect\":\"Reconectar\",\"reconnect_loading\":\"Carregando as orientações de reconexão…\",\"reconnect_error\":\"Não foi possível carregar as orientações de reconexão.\",\"reconnect_hint_sso\":\"Entre novamente para renovar esta conexão e depois atualize esta página.\",\"reconnect_hint_credential_process\":\"Execute este comando no seu terminal para renovar as credenciais e depois atualize esta página.\",\"reconnect_hint_other\":\"Execute este comando no seu terminal para restaurar a conexão e depois atualize esta página.\",\"copy\":\"Copiar\",\"copied\":\"Copiado\",\"empty_title\":\"Ainda sem contas\",\"empty_body\":\"Registre um dos perfis da AWS desta máquina em Adicionar contas, abaixo, e a conta dele aparece aqui.\",\"error_title\":\"Não foi possível carregar suas contas.\",\"error_body\":\"Algo deu errado ao ler a lista de contas. Tente novamente em instantes.\",\"error_forbidden_body\":\"Esta sessão do painel não é a do proprietário, por isso não pode gerenciar contas da AWS. Entre como proprietário e tente novamente.\",\"retry\":\"Tentar novamente\",\"disabled_title\":\"O AWS Control está desativado\",\"disabled_body\":\"Ative o app na App Store para ver suas contas.\",\"aggregate_accounts_one\":\"{{count}} conta\",\"aggregate_accounts_other\":\"{{count}} contas\",\"aggregate_keys_one\":\"{{count}} chave\",\"aggregate_keys_other\":\"{{count}} chaves\",\"aggregate_healthy_one\":\"{{count}} íntegra\",\"aggregate_healthy_other\":\"{{count}} íntegras\",\"keys_summary_one\":\"{{count}} chave\",\"keys_summary_other\":\"{{count}} chaves\",\"add_accounts_title\":\"Adicionar contas\",\"add_accounts_summary\":\"Registrar mais perfis da AWS desta máquina\",\"add_accounts_intro\":\"Estes perfis locais da AWS ainda não estão registrados. Cada um que você adicionar vira uma chave da conta dele.\",\"add_accounts_search_placeholder\":\"Buscar perfis\",\"add_accounts_search_keeps_selected\":\"Os perfis que você selecionou continuam na lista mesmo que não correspondam.\",\"add_accounts_none\":\"Todos os perfis locais já estão registrados.\",\"add_accounts_no_profiles\":\"Esta máquina ainda não tem perfis da AWS. Crie um primeiro (por exemplo, execute aws configure em um terminal) e depois registre-o aqui.\",\"add_accounts_unsupported\":\"No Windows, o AWS Control não consegue acessar os perfis da AWS desta máquina: o acesso à AWS precisa de um shell Linux ou macOS. Execute o gateway do {{productName}} no WSL (Windows Subsystem for Linux) e registre lá os perfis configurados.\",\"add_accounts_count_one\":\"{{count}} de {{max}} registrado\",\"add_accounts_count_other\":\"{{count}} de {{max}} registrados\",\"add_accounts_cap_reached\":\"Você atingiu o limite de {{max}} chaves. Remova uma antes de adicionar mais.\",\"add_accounts_register\":\"Registrar selecionados\",\"add_accounts_registering\":\"Registrando…\",\"add_accounts_error\":\"Não foi possível registrar esses perfis. Nada foi adicionado. Tente novamente.\",\"add_accounts_load_error\":\"Não foi possível listar os perfis locais da AWS.\",\"search_placeholder\":\"Buscar contas\",\"aggregate_accounts_many\":\"{{count}} contas\",\"aggregate_keys_many\":\"{{count}} chaves\",\"aggregate_healthy_many\":\"{{count}} íntegras\",\"keys_summary_many\":\"{{count}} chaves\",\"add_accounts_count_many\":\"{{count}} de {{max}} registrados\",\"paid_services_title\":\"Serviços pagos\",\"orphan_consent\":\"Confirmado para uma conta AWS que não está registrada aqui. Retire a confirmação abaixo, ou registre essa conta novamente para gerenciá-la na página dela.\",\"account_actions\":\"Ações da conta\",\"remove_account\":\"Remover do AWS Control…\",\"remove_account_action\":\"Remover\",\"remove_account_confirm\":\"Remover “{{name}}” do AWS Control? Nada muda na AWS nem na sua configuração da AWS CLI.\",\"remove_account_error\":\"Não foi possível remover a conta.\",\"remove_account_hint\":\"Nada muda na AWS\",\"forget_key_confirm\":\"Esquecer a chave “{{name}}” desta linha? Nada muda na AWS nem na sua configuração da AWS CLI.\",\"forget_key_action\":\"Esquecer chave\",\"totals_summary_one\":\"{{accounts}} conta · {{keys}}\",\"totals_summary_many\":\"{{accounts}} contas · {{keys}}\",\"totals_summary_other\":\"{{accounts}} contas · {{keys}}\",\"keys_healthy_one\":\"{{healthy}} de {{n}} chave íntegra\",\"keys_healthy_many\":\"{{healthy}} de {{n}} chaves íntegras\",\"keys_healthy_other\":\"{{healthy}} de {{n}} chaves íntegras\"},\"rail\":{\"accounts\":\"Contas e credenciais\",\"nav\":\"Seções do AWS Control\",\"switch_account\":\"Trocar de conta\",\"usage\":\"Uso e custos\",\"use_account\":\"Usar esta conta\"},\"overview\":{\"title\":\"Visão geral\",\"subtitle\":\"Um só lugar para as contas, chaves, unidade na nuvem e serviços pagos que seus agentes podem usar.\",\"stat_accounts\":\"Contas\",\"stat_accounts_attention_one\":\"{{count}} precisa de atenção\",\"stat_accounts_attention_other\":\"{{count}} precisam de atenção\",\"stat_accounts_all_ok\":\"Tudo em ordem\",\"stat_keys\":\"Chaves saudáveis\",\"stat_keys_sub_one\":\"{{count}} chave registrada\",\"stat_keys_sub_other\":\"{{count}} chaves registradas\",\"stat_drive\":\"Espaço usado\",\"stat_drive_none\":\"Nenhuma unidade\",\"stat_spend\":\"Mês até agora\",\"stat_spend_consent\":\"Relatório de custos desligado\",\"stat_shares_none\":\"Nada compartilhado\",\"stat_shares_sub_one\":\"{{count}} link ativo\",\"stat_shares_sub_other\":\"{{count}} links ativos\",\"stat_backups_nightly\":\"Noturno\",\"stat_backups_manual\":\"Manual\",\"stat_backups_sub_nightly\":\"Roda toda noite\",\"stat_backups_sub_manual\":\"Sem agendamento\",\"accounts_title\":\"Contas\",\"accounts_note\":\"Os agentes usam essas chaves sem nunca vê-las. Nada de uma chave aparece em um chat.\",\"add_account\":\"Adicionar conta\",\"drive_title\":\"Unidade na nuvem\",\"drive_bar_label\":\"{{size}} armazenados, entre arquivos, a biblioteca de artifacts e backups\",\"drive_empty_title\":\"Nenhuma unidade na nuvem\",\"drive_empty_body\":\"Crie um bucket privado e criptografado nesta conta para seus arquivos, a biblioteca de artifacts e os backups.\",\"drive_setup\":\"Configurar unidade na nuvem\",\"stat_accounts_attention_many\":\"{{count}} precisam de atenção\",\"stat_keys_sub_many\":\"{{count}} chaves registradas\",\"stat_shares_sub_many\":\"{{count}} links ativos\",\"drive_bucket_label\":\"Bucket\",\"stat_spend_scope\":\"Fatura da AWS desta conta\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "Confirme o uso da AWS antes da primeira solicitacao",
				"confirmed_title": "Uso da AWS confirmado",
				"account_changed": "Isto foi confirmado para outra conta da AWS, por isso a confirmacao foi retirada. Revise a conta abaixo e confirme novamente.",
				"service": "Servico",
				"region": "Regiao",
				"credential_source": "Origem das credenciais",
				"aws_account": "Conta da AWS",
				"provider_default": "(padrao do provedor)",
				"unresolved_account": "nao foi possivel resolver",
				"billing_notice": "Este e um servico pago da AWS. Ate voce confirmar, nenhuma solicitacao e enviada.",
				"confirm_button": "Confirmar e ativar",
				"withdraw": "Retirar a confirmacao",
				"status_failed": "Não foi possível ler o status da confirmação.",
				"confirm_failed": "A confirmação não foi registrada.",
				"withdraw_failed": "A confirmação não foi retirada.",
				"retry": "Tentar novamente",
				"badge_confirmed": "Confirmado",
				"badge_not_enabled": "Não ativado",
				"confirmed_on": "confirmado {{date}}",
				"billing_notice_short": "Cobrado. Nada é enviado até você confirmar.",
				"pending_profile_hint": "Termine de editar o perfil da AWS para confirmar.",
				"bedrock_kb_billing_short": "Cobrado a cada pesquisa: uma chamada Bedrock Retrieve por Knowledge Base",
				"aws_pricing_link": "Preços da AWS",
				"withdraw_effect": "Ao retirar, os agentes deixam de usar este serviço até você confirmar de novo."
			},
			"ui": {
				"clear_filter": "Limpar filtro",
				"no_matches_for": "Sem correspondências para",
				"no_noun_match": "Nenhum(a) {{noun}} correspondente"
			}
		}
	},
	ru: {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"Ваши облачные аккаунты понятным языком. Просматривайте каждый аккаунт AWS, доступный Kiro Crew, с индикатором состояния для каждого аккаунта и подобранными подсказками по переподключению, а также облачный диск на основе S3 — файлы, облачную библиотеку артефактов и резервные копии — со ссылками с ограниченным сроком действия. Ничто не становится публичным без вашего согласия, и каждая платная услуга запрашивает подтверждение, прежде чем начать списывать средства.\",\"display_name\":\"AWS Control\",\"highlight_1\":\"Один индикатор состояния на аккаунт, каждый с подсказками по переподключению в зависимости от способа аутентификации профиля\",\"highlight_2\":\"Приватное, зашифрованное хранилище с версиями, создаваемое только после вашего подтверждения\",\"highlight_3\":\"Ваша облачная библиотека артефактов, файлы и резервные копии — всё в одном принадлежащем вам бакете\",\"highlight_4\":\"Ссылки для доступа всегда имеют срок действия — ничто не становится публичным без вашего согласия\",\"highlight_5\":\"Каждая платная услуга подтверждается для аккаунта перед первым использованием, и каждое изменение фиксируется\",\"page_label\":\"AWS Control\",\"use_case_1\":\"Смотрите каждый аккаунт AWS, доступный Kiro Crew, какие из них исправны и сколько стоит этот месяц, не открывая консоль AWS.\",\"configuration_1\":\"Добавьте аккаунт из профилей, которые уже есть на этой машине, затем подтвердите каждую платную услугу один раз для каждого аккаунта до первого использования.\"},\"console\":{\"copy\":\"Копировать\",\"copied\":\"Скопировано\",\"close\":\"Закрыть\",\"loading\":\"Загрузка…\",\"download\":\"Скачать\",\"share\":\"Поделиться\",\"delete\":\"Удалить\",\"delete_failed\":\"Не удалось удалить — файл не изменён. Повторите попытку.\",\"delete_failed_named\":\"Не удалось удалить «{{name}}» — файл не изменён. Попробуйте снова.\",\"download_failed\":\"Не удалось начать загрузку. Ничего не было отправлено. Попробуйте снова.\",\"delete_confirm_action\":\"Удалить файл\",\"delete_confirm\":\"Удалить «{{name}}»? Файл будет убран из диска.\",\"col_name\":\"Название\",\"col_kind\":\"Тип\",\"col_size\":\"Размер\",\"col_modified\":\"Изменено\",\"col_actions\":\"Действия\",\"kind_folder\":\"Папка\",\"folder_new\":\"Новая папка\",\"folder_name\":\"Название папки\",\"folder_delete_confirm\":\"Удалить «{{name}}» и всё её содержимое?\",\"folder_delete_action\":\"Удалить папку\",\"folder_delete_failed\":\"Не удалось удалить папку.\",\"folder_create_failed\":\"Не удалось создать папку.\",\"folder_bad_name\":\"В этом имени папки есть символы, которые диск не может сохранить. Буквы, цифры, пробелы и . _ - ( ) + @ = безопасны.\",\"folder_deleted_one\":\"«{{name}}» удалена: {{count}} элемент.\",\"folder_deleted_few\":\"«{{name}}» удалена: {{count}} элемента.\",\"folder_deleted_many\":\"«{{name}}» удалена: {{count}} элементов.\",\"folder_deleted_other\":\"«{{name}}» удалена: {{count}} элементов.\",\"cancel\":\"Отмена\",\"load_more\":\"Показать ещё\",\"stat_this_month\":\"За этот месяц\",\"storage_consent_needed\":\"Облачное хранилище для этого аккаунта ещё не подтверждено. Подтвердите его ниже и обновите страницу.\",\"stat_stored_value\":\"{{size}} · {{objects}} элементов\",\"costs_as_of\":\"Кэшированные данные по состоянию на {{date}}.\",\"costs_consent_missing\":\"Включите отчёт о расходах ниже, чтобы увидеть траты этого аккаунта.\",\"costs_unavailable\":\"Сейчас не удалось получить данные о счёте.\",\"account_unavailable\":\"Этот аккаунт сейчас недоступен. Переподключите его и вернитесь позже.\",\"drive_status_failed\":\"Сейчас не удалось прочитать диск.\",\"setup_title\":\"Настроить облачный диск\",\"setup_body\":\"Создаётся один приватный зашифрованный бакет с версиями в вашем собственном аккаунте — для ваших файлов, библиотеки артефактов и резервных копий.\",\"setup_searched_region\":\"Диск не найден в {{region}}. Поиск шёл только в этом регионе, поэтому диск в другом регионе этого аккаунта здесь не появится.\",\"setup_costs_note\":\"Стоимость зависит от использования: вы платите AWS за хранение и ничего до этого.\",\"setup_preview_region\":\"Регион\",\"setup_preview_resource\":\"Ресурс\",\"setup_preview_btn\":\"Предпросмотр\",\"setup_confirm_btn\":\"Создать\",\"setup_creating\":\"Создание…\",\"setup_error\":\"Не удалось подготовить диск. Повторите попытку через мгновение.\",\"setup_confirm_error\":\"Не удалось создать диск. Ничего не изменено — проверьте разрешения ниже и повторите попытку.\",\"setup_policy_error\":\"Не удалось загрузить разрешения для вставки.\",\"setup_policy_label\":\"Показать точные разрешения для вставки\",\"library_all\":\"Все\",\"library_not_pushable\":\"Изображения пока нельзя скопировать в облако.\",\"kind_widget\":\"Виджет\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"Текст\",\"kind_webapp\":\"Веб-приложение\",\"kind_image\":\"Изображение\",\"drive_title\":\"Диск\",\"drive_upload\":\"Загрузить\",\"drive_uploading\":\"Загрузка…\",\"drive_bad_name\":\"В имени файла есть символы, которые диск не может сохранить. Буквы, цифры, пробелы и . _ - ( ) + @ = безопасны.\",\"rename_bad_name\":\"В имени есть символы, которые диск не может сохранить. Измените имя и попробуйте снова.\",\"drive_bad_name_named\":\"Не удаётся загрузить «{{name}}»: в имени есть символы, которые диск не может сохранить. Буквы, цифры, пробелы и . _ - ( ) + @ = безопасны.\",\"drive_upload_failed\":\"Не удалось загрузить «{{name}}». Попробуйте снова.\",\"section_files\":\"Файлы\",\"section_library\":\"Библиотека артефактов\",\"section_backup\":\"Резервная копия\",\"share_title\":\"Поделиться «{{name}}»\",\"share_expiry\":\"Ссылка истекает через\",\"share_note\":\"Примечание\",\"share_note_placeholder\":\"Для чего эта ссылка?\",\"share_create\":\"Создать ссылку\",\"share_creating\":\"Создание…\",\"share_failed\":\"Не удалось создать ссылку для доступа. Ничем не поделились.\",\"expiry_1h\":\"1 час\",\"expiry_1d\":\"1 день\",\"expiry_7d\":\"7 дней\",\"share_expires_note\":\"Ссылка перестанет работать по истечении срока, и её нельзя отозвать раньше.\",\"share_credentials_caveat\":\"Она может перестать работать раньше, если сессия входа в аккаунт завершится первой.\",\"cli_drawer_label\":\"Где это хранится\",\"cli_drawer_hint\":\"Эти файлы хранятся по пути {{prefix}} в бакете {{bucket}}. Эта команда выводит их список из терминала с вашими учётными данными.\",\"backup_title\":\"Резервная копия\",\"backup_kind_snapshot\":\"Память и рабочее пространство\",\"backup_kind_sessions\":\"Архив сессий\",\"backup_last_run\":\"Последняя копия {{when}} · {{size}}\",\"backup_never\":\"Резервная копия ещё не создавалась\",\"backup_never_recorded\":\"Здесь нет записи о запуске — более ранние архивы могут всё ещё быть на диске\",\"backup_remembered\":\"Архивы, записанные этой установкой: {{count}} · показать список\",\"backup_sessions_scope\":\"Включает журналы воспроизведения CLI для всех сеансов в этом домашнем каталоге Kiro, а не только для чатов, начатых в {{productName}}.\",\"backup_run_now\":\"Создать копию\",\"backup_running\":\"Создание копии…\",\"backup_failed\":\"Последняя копия не создана: {{reason}}\",\"backup_start_failed\":\"Не удалось запустить создание копии.\",\"backup_start_retry\":\"Не удалось запустить создание копии. Попробуйте снова.\",\"backup_start_unavailable\":\"Резервное копирование недоступно для этого приложения. Проверьте, зарегистрирована ли среда выполнения задач.\",\"backup_start_consent\":\"Предоставьте доступ к S3 для этого аккаунта, затем запустите резервное копирование.\",\"backup_start_no_drive\":\"У этого аккаунта пока нет диска. Создайте его, затем запустите резервное копирование.\",\"backup_nightly\":\"Создавать копию каждую ночь\",\"backup_nightly_hint\":\"Раз в день создаёт снимок памяти и рабочего пространства.\",\"backup_nightly_blocked_other_account\":\"Ночные снимки выполняются только для аккаунта по умолчанию, поэтому для этого аккаунта ничего не сохраняется.\",\"backup_nightly_sessions\":\"Сохранять сеансы каждую ночь\",\"backup_nightly_sessions_hint\":\"Загружает архив сеансов на диск этого аккаунта раз в сутки. В нём содержатся ваши переписки без изменений, ничего не удаляется.\",\"backup_nightly_sessions_destination\":\"Этот диск - хранилище S3 в этом аккаунте AWS, и {{button}} отправляет архив туда же.\",\"backup_nightly_sessions_blocked_host\":\"Этот компьютер не может создать архив сеансов, поэтому ничего не загружается.\",\"backup_nightly_sessions_blocked_redaction\":\"Скрытие исходящих данных включено, а архив сеансов пока нельзя обработать, поэтому ничего не загружается.\",\"backup_nightly_sessions_blocked_other_account\":\"Ночные загрузки выполняются только для аккаунта по умолчанию, поэтому для этого аккаунта ничего не загружается.\",\"backup_nightly_sessions_blocked_other\":\"Ночные загрузки на этом компьютере приостановлены, поэтому ничего не загружается.\",\"backup_nightly_sessions_blocked_next\":\"Вы по-прежнему можете запустить копирование вручную.\",\"backup_nightly_sessions_blocked_next_redaction\":\"Вы по-прежнему можете запустить копирование вручную, но архив сеансов загружается без скрытия.\",\"backup_archive\":\"Сохранённые копии\",\"backup_restore\":\"Восстановить\",\"backup_show_all_archives\":\"Показать все ({{count}})\",\"backup_restore_caveat\":\"Для восстановления нужен доступ на чтение к папке резервных копий. Рекомендуемая политика минимальных прав намеренно выдаёт только запись, поэтому восстановление будет отклонено, если учётные данные аккаунта не шире.\",\"backup_remote_error\":\"Сейчас не удалось прочитать сохранённые копии.\",\"backup_status_failed\":\"Не удалось прочитать состояние резервных копий.\",\"backup_nightly_failed\":\"Не удалось изменить «{{setting}}». Настройка осталась прежней.\",\"backup_restore_failed\":\"Не удалось восстановить эту копию. Ничего не записано.\",\"backup_restored_note\":\"Ваши текущие данные не были заменены. Резервная копия загружена в промежуточную папку по указанному ниже пути.\",\"backup_restore_recovered_note\":\"Скачана собственная загрузка этой установки, она сверена с тем, что установка записала. На диске её перезаписало что-то другое, и так же может быть перезаписана твоя следующая загрузка. Начни с других установок, которые эта страница показывает как делающие резервные копии на этот диск.\",\"backup_install\":\"Эта установка\",\"backup_install_hint\":\"Каждая установка хранит свои резервные копии под собственным именем, чтобы при восстановлении можно было отличить архивы этой установки от архивов другой установки.\",\"backup_install_rename\":\"Переименовать\",\"backup_install_save\":\"Сохранить имя\",\"backup_install_rename_failed\":\"Не удалось сохранить имя установки. Оно не изменилось.\",\"backup_install_name_label\":\"Имя установки\",\"backup_attribution_self\":\"{{label}} · эта установка\",\"backup_attribution_self_unnamed\":\"эта установка\",\"backup_attribution_other\":\"«{{label}}» (другая установка · {{id}})\",\"backup_attribution_other_unnamed\":\"другая установка · {{id}}\",\"backup_attribution_unverified\":\"непроверенное происхождение\",\"backup_origin_unknown\":\"неизвестное происхождение\",\"backup_none_from_this_install\":\"Нет резервных копий от этой установки. Включи архивы других установок, чтобы увидеть их.\",\"backup_others_on_drive\":\"Другие установки, делающие резервные копии на этот диск: {{count}}\",\"backup_show_others\":\"Включить архивы других установок\",\"backup_others_truncated\":\"Показаны только первые {{max}} других установок.\",\"backup_archives_truncated\":\"Часть архивов ({{kind}}) не удалось перечислить. Самых новых здесь может не быть.\",\"backup_shared_note\":\"Один диск, общий для двух установок, — это не общая память и не общие сессии. Каждая резервная копия — отдельный архив одного момента, а восстановление лишь загружает этот файл в промежуточную папку: файлы ты заменяешь сам, при остановленном gateway.\",\"backup_restore_foreign_confirm\":\"Этот архив загрузила другая установка ({{install}}). Его восстановление скачивает данные той установки, а не этой установки. Всё равно скачать?\",\"backup_restore_unverified_confirm\":\"Этот архив лежит в собственной папке этой установки, но у этой установки нет записи о его загрузке. Любой, кто может писать на диск, способен создать такую папку, поэтому он может быть и не с этой установки. Всё равно скачать?\",\"backup_restore_unknown_confirm\":\"Этот архив был загружен до того, как установкам дали имена, поэтому неизвестно, какая установка его записала. Всё равно скачать?\",\"backup_restore_overwritten_confirm\":\"Эта установка загрузила этот архив, но на диске уже не то, что она загрузила — с тех пор его перезаписало что-то другое. Всё равно скачать?\",\"backup_restore_overwritten_refused\":\"Эта установка загрузила этот архив, но на диске уже не то, что она загрузила. Чтобы всё равно скачать его, открой Сохранённые копии и выбери Скачать.\",\"backup_restore_foreign_refused\":\"Этот архив принадлежит другой установке. Подтверди восстановление, чтобы всё равно скачать его.\",\"backup_restore_confirm_yes\":\"Скачать\",\"backup_restore_confirm_no\":\"Отмена\",\"access_title\":\"Ссылки для общего доступа\",\"access_empty\":\"Нет активных ссылок для доступа.\",\"access_expires_in\":\"истекает {{when}}\",\"access_forget\":\"Убрать из списка\",\"access_object_missing\":\"Файл удалён\",\"access_unchecked\":\"Эти ссылки не сверялись с диском, поэтому удалённый файл здесь не отмечается.\",\"access_footer\":\"Удаление ссылки из списка не отзывает её — общая ссылка работает до истечения срока.\",\"access_list_failed\":\"Не удалось прочитать ссылки для доступа.\",\"access_forget_failed\":\"Не удалось убрать эту ссылку из списка. Она всё ещё в списке.\",\"keys_count_one\":\"{{count}} ключ\",\"keys_count_few\":\"{{count}} ключа\",\"keys_count_many\":\"{{count}} ключей\",\"keys_count_other\":\"{{count}} ключей\",\"keys_for_account\":\"Ключи: {{name}}\",\"key_healthy\":\"Исправен\",\"parent_folders\":\"Родительские папки\",\"folder_actions\":\"Действия с папкой\",\"file_actions\":\"Действия с файлом\",\"root_storage_used\":\"Что занимает место\",\"root_section_objects_one\":\"{{objects}} объект\",\"root_section_objects_few\":\"{{objects}} объекта\",\"root_section_objects_many\":\"{{objects}} объектов\",\"root_section_objects_other\":\"{{objects}} объектов\",\"view_grid\":\"Сетка\",\"view_list\":\"Список\",\"library_add\":\"Добавить из артефактов\",\"library_add_one\":\"Добавить в «Библиотеку артефактов»\",\"folder_open\":\"Открыть папку {{name}}\",\"library_adding\":\"Добавление…\",\"library_add_oneway\":\"Копии занимают место в облаке.\",\"library_add_again\":\"Добавить снова\",\"library_add_count\":\"Добавить из артефактов (готово: {{count}})\",\"library_add_nothing\":\"Добавить больше нечего - всё возможное уже здесь.\",\"library_list_failed\":\"Не удалось прочитать содержимое в облаке.\",\"files_list_failed\":\"Не удалось прочитать эту папку.\",\"library_local_failed\":\"Не удалось прочитать ваши артефакты.\",\"retry\":\"Повторить\",\"library_add_none\":\"Нет подходящих артефактов.\",\"library_update\":\"Обновить копию\",\"library_search\":\"Поиск ваших артефактов\",\"library_push_failed\":\"Не удалось добавить этот артефакт. Попробуйте ещё раз.\",\"library_blurb\":\"То, что Kiro создал для вас, скопировано в облако. Файлы, загруженные вами, находятся в разделе «Файлы».\",\"library_empty_title\":\"В облако пока ничего не скопировано\",\"library_empty_body\":\"В этой папке хранится то, что Kiro создал для вас — виджеты, страницы, документы, — после того как вы скопируете их в облако. Файлы, загруженные с компьютера, следует помещать в раздел «Файлы».\",\"library_cloud_only\":\"Только в облаке\",\"library_in_cloud\":\"В облаке\",\"library_stale_preview\":\"В облаке хранится v{{version}}; в предпросмотре показана более новая локальная копия\",\"library_stale_list\":\"Копия в облаке — v{{version}}; локальная копия новее\",\"library_added\":\"Добавлено {{when}}\",\"library_open\":\"Открыть {{name}} в Артефактах\",\"files_empty_title\":\"Раздел «Файлы» пуст\",\"files_empty_body\":\"В этой папке хранятся файлы, загруженные с компьютера. Она отделена от раздела «Библиотека артефактов», где хранится то, что Kiro создал для вас.\",\"library_remove\":\"Убрать\",\"library_remove_confirm\":\"Убрать «{{name}}» из облачной библиотеки?\",\"library_remove_confirm_slug\":\"Это очистит облачную папку <folder>{{folder}}</folder>.\",\"library_actions\":\"Действия с элементом библиотеки\",\"library_remove_action\":\"Убрать копию\",\"library_removing\":\"Убираем…\",\"library_remove_failed\":\"Не удалось убрать — облачная копия не изменена. Повторите попытку.\",\"move_conflict\":\"В целевой папке уже есть файл с таким именем. Выбери другую папку или сначала переименуй файл.\",\"move_shared\":\"У этого файла есть действующая ссылка общего доступа — перемещение сделает её нерабочей. Удалите ссылку (или дождитесь её истечения) и попробуйте снова.\",\"rename\":\"Переименовать\",\"preview_truncated\":\"Большой файл — показано только начало.\",\"preview_redacted\":\"Конфиденциальные значения в этом предпросмотре скрыты.\",\"preview_unsupported\":\"Предпросмотр этого типа файлов недоступен. Скачайте файл, чтобы посмотреть.\",\"preview_failed\":\"Не удалось загрузить предпросмотр. Скачайте файл, чтобы посмотреть, или попробуйте снова.\",\"search_files\":\"Поиск по имени файла или пути…\",\"search_clear\":\"Очистить поиск\",\"search_pending\":\"Идёт поиск…\",\"search_capped\":\"Слишком много совпадений — показаны первые {{count}}.\",\"search_failed\":\"Поиск не удался. Попробуйте снова.\",\"search_goto\":\"Открыть содержащую папку\",\"move_failed\":\"Не удалось переместить файл. Попробуйте ещё раз.\",\"rename_conflict\":\"Файл с таким именем здесь уже есть.\",\"rename_shared\":\"У этого файла есть действующая ссылка для общего доступа — переименование сделает её недействительной. Удалите общий доступ (или дождитесь его истечения) и повторите попытку.\",\"rename_failed\":\"Не удалось переименовать файл. Повторите попытку.\",\"rename_failed_named\":\"Не удалось переименовать «{{name}}»: {{reason}}\",\"library_add_empty\":\"Артефактов пока нет. То, что Kiro создаст для вас, появится здесь и будет готово к копированию в облако.\",\"move_to\":\"Переместить в папку…\",\"move_title\":\"Переместить «{{name}}» в\",\"move_root\":\"Файлы (верхний уровень)\",\"move_up\":\"Вверх, в {{name}}\",\"move_no_folders\":\"Здесь нет другой папки, в которую можно переместить файл. Сначала создайте её.\",\"move_moving\":\"Перемещение…\",\"move_moving_picker\":\"Перемещение… Если закрыть окно, перемещение не отменится.\",\"move_to_busy\":\"Ещё выполняется другое перемещение\",\"move_ask_agent\":\"Спросить агента об этом перемещении\",\"stat_storage\":\"Хранилище\",\"stat_objects\":\"Объекты\",\"key_needs_attention\":\"Требует внимания\",\"backup_state_current\":\"Есть копия\",\"backup_state_never\":\"Ни разу не запускался\",\"costs_refresh_failed\":\"Последнее чтение счёта не удалось. Показано значение из кеша.\"},\"page\":{\"refresh\":\"Обновить\",\"health_ok\":\"Исправно\",\"health_degraded\":\"Требует внимания\",\"health_unknown\":\"Неизвестно\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"Процесс получения учётных данных\",\"kind_other\":\"Другое\",\"default_profile\":\"Профиль по умолчанию\",\"not_connected_yet\":\"Ещё не подключено\",\"reconnect\":\"Переподключить\",\"reconnect_loading\":\"Загрузка подсказок по переподключению…\",\"reconnect_error\":\"Не удалось загрузить подсказки по переподключению.\",\"reconnect_hint_sso\":\"Войдите снова, чтобы обновить это подключение, затем обновите эту страницу.\",\"reconnect_hint_credential_process\":\"Выполните эту команду в терминале, чтобы обновить учётные данные, затем обновите эту страницу.\",\"reconnect_hint_other\":\"Выполните эту команду в терминале, чтобы восстановить подключение, затем обновите эту страницу.\",\"copy\":\"Копировать\",\"copied\":\"Скопировано\",\"empty_title\":\"Пока нет аккаунтов\",\"empty_body\":\"Зарегистрируйте один из профилей AWS этого компьютера в разделе «Добавить аккаунты» ниже, и его аккаунт появится здесь.\",\"error_title\":\"Не удалось загрузить ваши аккаунты.\",\"error_body\":\"При чтении списка аккаунтов произошла ошибка. Повторите попытку через мгновение.\",\"error_forbidden_body\":\"Этот сеанс панели не принадлежит владельцу, поэтому не может управлять аккаунтами AWS. Войдите как владелец и повторите попытку.\",\"retry\":\"Повторить\",\"disabled_title\":\"AWS Control отключён\",\"disabled_body\":\"Включите приложение в App Store, чтобы увидеть свои аккаунты.\",\"aggregate_accounts_one\":\"{{count}} аккаунт\",\"aggregate_accounts_other\":\"{{count}} аккаунтов\",\"aggregate_keys_one\":\"{{count}} ключ\",\"aggregate_keys_other\":\"{{count}} ключей\",\"aggregate_healthy_one\":\"{{count}} исправен\",\"aggregate_healthy_other\":\"{{count}} исправны\",\"keys_summary_one\":\"{{count}} ключ\",\"keys_summary_other\":\"{{count}} ключей\",\"add_accounts_title\":\"Добавить аккаунты\",\"add_accounts_summary\":\"Зарегистрировать больше профилей AWS с этого компьютера\",\"add_accounts_intro\":\"Эти локальные AWS-профили ещё не зарегистрированы. Каждый добавленный профиль становится ключом своего аккаунта.\",\"add_accounts_search_placeholder\":\"Поиск профилей\",\"add_accounts_search_keeps_selected\":\"Выбранные профили остаются в списке, даже если они не соответствуют фильтру.\",\"add_accounts_none\":\"Все локальные профили уже зарегистрированы.\",\"add_accounts_no_profiles\":\"На этом компьютере пока нет профилей AWS. Сначала создай профиль (например, выполни aws configure в терминале), затем зарегистрируй его здесь.\",\"add_accounts_unsupported\":\"В Windows AWS Control не может обратиться к профилям AWS этого компьютера: для доступа к AWS нужна оболочка Linux или macOS. Запустите шлюз {{productName}} в WSL (Windows Subsystem for Linux) и зарегистрируйте настроенные там профили.\",\"add_accounts_count_one\":\"{{count}} из {{max}} зарегистрирован\",\"add_accounts_count_other\":\"{{count}} из {{max}} зарегистрировано\",\"add_accounts_cap_reached\":\"Достигнут предел в {{max}} ключей. Удалите один, прежде чем добавлять ещё.\",\"add_accounts_register\":\"Зарегистрировать выбранные\",\"add_accounts_registering\":\"Регистрация…\",\"add_accounts_error\":\"Не удалось зарегистрировать эти профили. Ничего не было добавлено. Попробуйте снова.\",\"add_accounts_load_error\":\"Не удалось получить список локальных профилей AWS.\",\"search_placeholder\":\"Поиск аккаунтов\",\"aggregate_accounts_few\":\"{{count}} аккаунта\",\"aggregate_accounts_many\":\"{{count}} аккаунтов\",\"aggregate_keys_few\":\"{{count}} ключа\",\"aggregate_keys_many\":\"{{count}} ключей\",\"aggregate_healthy_few\":\"{{count}} исправны\",\"aggregate_healthy_many\":\"{{count}} исправны\",\"keys_summary_few\":\"{{count}} ключа\",\"keys_summary_many\":\"{{count}} ключей\",\"add_accounts_count_few\":\"{{count}} из {{max}} зарегистрировано\",\"add_accounts_count_many\":\"{{count}} из {{max}} зарегистрировано\",\"paid_services_title\":\"Платные сервисы\",\"orphan_consent\":\"Подтверждено для аккаунта AWS, который здесь не зарегистрирован. Отзовите подтверждение ниже или зарегистрируйте этот аккаунт снова, чтобы управлять им на его собственной странице.\",\"account_actions\":\"Действия с аккаунтом\",\"remove_account\":\"Убрать из AWS Control…\",\"remove_account_action\":\"Убрать\",\"remove_account_confirm\":\"Убрать «{{name}}» из AWS Control? В AWS и в вашей конфигурации AWS CLI ничего не изменится.\",\"remove_account_error\":\"Не удалось убрать аккаунт.\",\"remove_account_hint\":\"В AWS ничего не изменится\",\"forget_key_confirm\":\"Забыть ключ «{{name}}» этой строки? В AWS и в вашей конфигурации AWS CLI ничего не изменится.\",\"forget_key_action\":\"Забыть ключ\",\"totals_summary_one\":\"Аккаунтов: {{accounts}} · {{keys}}\",\"totals_summary_few\":\"Аккаунтов: {{accounts}} · {{keys}}\",\"totals_summary_many\":\"Аккаунтов: {{accounts}} · {{keys}}\",\"totals_summary_other\":\"Аккаунтов: {{accounts}} · {{keys}}\",\"keys_healthy_one\":\"Исправных ключей: {{healthy}} из {{n}}\",\"keys_healthy_few\":\"Исправных ключей: {{healthy}} из {{n}}\",\"keys_healthy_many\":\"Исправных ключей: {{healthy}} из {{n}}\",\"keys_healthy_other\":\"Исправных ключей: {{healthy}} из {{n}}\"},\"rail\":{\"accounts\":\"Аккаунты и учётные данные\",\"nav\":\"Разделы AWS Control\",\"switch_account\":\"Сменить аккаунт\",\"usage\":\"Использование и расходы\",\"use_account\":\"Использовать этот аккаунт\"},\"overview\":{\"title\":\"Обзор\",\"subtitle\":\"Одна комната для аккаунтов, ключей, облачного диска и платных сервисов, к которым допущены ваши агенты.\",\"stat_accounts\":\"Аккаунты\",\"stat_accounts_attention_one\":\"{{count}} требует внимания\",\"stat_accounts_attention_other\":\"{{count}} требуют внимания\",\"stat_accounts_all_ok\":\"Всё в порядке\",\"stat_keys\":\"Ключи в порядке\",\"stat_keys_sub_one\":\"{{count}} ключ добавлен\",\"stat_keys_sub_other\":\"{{count}} ключей добавлено\",\"stat_drive\":\"Занято на диске\",\"stat_drive_none\":\"Диска ещё нет\",\"stat_spend\":\"С начала месяца\",\"stat_spend_consent\":\"Отчёт о расходах выключен\",\"stat_shares_none\":\"Нет общего доступа\",\"stat_shares_sub_one\":\"{{count}} активная ссылка\",\"stat_shares_sub_other\":\"{{count}} активных ссылок\",\"stat_backups_nightly\":\"Ночью\",\"stat_backups_manual\":\"Вручную\",\"stat_backups_sub_nightly\":\"Запускается каждую ночь\",\"stat_backups_sub_manual\":\"Расписание не задано\",\"accounts_title\":\"Аккаунты\",\"accounts_note\":\"Агенты используют эти ключи, никогда их не видя. Ничего из ключа не попадает в чат.\",\"add_account\":\"Добавить аккаунт\",\"drive_title\":\"Облачный диск\",\"drive_bar_label\":\"{{size}} хранится: файлы, библиотека артефактов и резервные копии\",\"drive_empty_title\":\"Облачного диска пока нет\",\"drive_empty_body\":\"Создайте один приватный зашифрованный бакет в этом аккаунте для файлов, библиотеки артефактов и резервных копий.\",\"drive_setup\":\"Настроить облачный диск\",\"stat_accounts_attention_few\":\"{{count}} требуют внимания\",\"stat_accounts_attention_many\":\"{{count}} требуют внимания\",\"stat_keys_sub_few\":\"{{count}} ключа добавлено\",\"stat_keys_sub_many\":\"{{count}} ключей добавлено\",\"stat_shares_sub_few\":\"{{count}} активные ссылки\",\"stat_shares_sub_many\":\"{{count}} активных ссылок\",\"drive_bucket_label\":\"Бакет\",\"stat_spend_scope\":\"Счёт AWS этого аккаунта\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "Подтвердите использование AWS до первого запроса",
				"confirmed_title": "Использование AWS подтверждено",
				"account_changed": "Подтверждение относилось к другому аккаунту AWS, поэтому оно было отозвано. Проверьте аккаунт ниже и подтвердите снова.",
				"service": "Сервис",
				"region": "Регион",
				"credential_source": "Источник учётных данных",
				"aws_account": "Аккаунт AWS",
				"provider_default": "(значение поставщика по умолчанию)",
				"unresolved_account": "не удалось определить",
				"billing_notice": "Это платный сервис AWS. До подтверждения запросы не отправляются.",
				"confirm_button": "Подтвердить и включить",
				"withdraw": "Отозвать подтверждение",
				"status_failed": "Не удалось прочитать состояние подтверждения.",
				"confirm_failed": "Подтверждение не было записано.",
				"withdraw_failed": "Подтверждение не было отозвано.",
				"retry": "Повторить",
				"badge_confirmed": "Подтверждено",
				"badge_not_enabled": "Не включено",
				"confirmed_on": "подтверждено {{date}}",
				"billing_notice_short": "Платно. Ничего не отправляется, пока вы не подтвердите.",
				"pending_profile_hint": "Закончи ввод профиля AWS, чтобы подтвердить.",
				"bedrock_kb_billing_short": "Оплата за каждый поиск: один вызов Bedrock Retrieve на Knowledge Base",
				"aws_pricing_link": "Цены AWS",
				"withdraw_effect": "После отзыва агенты перестанут использовать этот сервис, пока ты не подтвердишь снова."
			},
			"ui": {
				"clear_filter": "Очистить фильтр",
				"no_matches_for": "Нет совпадений для",
				"no_noun_match": "Нет совпадающих {{noun}}"
			}
		}
	},
	"zh-CN": {
		apps: /* @__PURE__ */ JSON.parse("{\"awsControl\":{\"manifest\":{\"description\":\"用平实的语言呈现你的云账户。查看 Kiro Crew 可用的每一个 AWS 账户，每个账户都配有健康状态指示灯和相应重连指引，还提供由 S3 支持的云端硬盘——文件、云端产物库和备份——并附带限时分享链接。除非你明确同意，否则任何内容都不会公开；每一项付费服务在计费前都会先征求你的确认。\",\"display_name\":\"AWS Control\",\"highlight_1\":\"每个账户一盏健康状态指示灯，各自配有与该配置文件认证方式相匹配的重连指引\",\"highlight_2\":\"私密、加密、带版本的存储，只有在你确认之后才会创建\",\"highlight_3\":\"你的云端产物库、文件和备份全部存放在一个由你自己拥有的存储桶上\",\"highlight_4\":\"分享链接始终会过期——除非你明确同意，否则任何内容都不会公开\",\"highlight_5\":\"每一项付费服务在首次使用前都会按账户逐一确认，且每一次变更都有记录\",\"page_label\":\"AWS Control\",\"use_case_1\":\"一眼看清 Kiro Crew 能访问的每个 AWS 账户、哪些连接正常、以及本月花了多少钱——不必打开 AWS 控制台。\",\"configuration_1\":\"从这台机器上已有的配置里添加账户，每个付费服务在首次使用前按账户逐一确认。\"},\"console\":{\"copy\":\"复制\",\"copied\":\"已复制\",\"close\":\"关闭\",\"loading\":\"加载中…\",\"download\":\"下载\",\"share\":\"分享\",\"delete\":\"删除\",\"delete_failed\":\"删除失败——文件未受影响。请重试。\",\"delete_failed_named\":\"无法删除“{{name}}”——文件未改动。请重试。\",\"download_failed\":\"无法开始下载。没有发送任何内容。请重试。\",\"delete_confirm_action\":\"删除文件\",\"delete_confirm\":\"删除“{{name}}”？文件将从云盘中移除。\",\"col_name\":\"名称\",\"col_kind\":\"类型\",\"col_size\":\"大小\",\"col_modified\":\"修改时间\",\"col_actions\":\"操作\",\"kind_folder\":\"文件夹\",\"folder_new\":\"新建文件夹\",\"folder_name\":\"文件夹名称\",\"folder_delete_confirm\":\"删除“{{name}}”及其中的全部内容？\",\"folder_delete_action\":\"删除文件夹\",\"folder_delete_failed\":\"无法删除该文件夹。\",\"folder_create_failed\":\"无法创建该文件夹。\",\"folder_bad_name\":\"该文件夹名称包含硬盘无法存储的字符。字母、数字、空格以及 . _ - ( ) + @ = 是安全的。\",\"folder_deleted_other\":\"已删除“{{name}}”：{{count}} 个项目。\",\"cancel\":\"取消\",\"load_more\":\"加载更多\",\"stat_this_month\":\"本月\",\"storage_consent_needed\":\"这个账户的云存储还没有确认。在下方确认后再刷新。\",\"stat_stored_value\":\"{{size}} · {{objects}} 个项目\",\"costs_as_of\":\"缓存数据，截至 {{date}}。\",\"costs_consent_missing\":\"在下方开启费用报告，即可查看此账户的支出。\",\"costs_unavailable\":\"暂时读不到账单。\",\"account_unavailable\":\"目前无法连接到此账户。请重新连接后再回来查看。\",\"drive_status_failed\":\"目前无法读取该硬盘。\",\"setup_title\":\"设置云端硬盘\",\"setup_body\":\"这会在你的账户中创建一个私密、加密并带版本控制的存储桶，用来存放文件、产物库和备份。\",\"setup_searched_region\":\"在 {{region}} 中未找到云端硬盘。只搜索了这个区域，所以此账户在其他区域的云端硬盘不会显示在这里。\",\"setup_costs_note\":\"费用随使用量而定：你按存储量向 AWS 付费，在此之前不产生任何费用。\",\"setup_preview_region\":\"区域\",\"setup_preview_resource\":\"资源\",\"setup_preview_btn\":\"预览\",\"setup_confirm_btn\":\"创建\",\"setup_creating\":\"创建中…\",\"setup_error\":\"无法准备该硬盘。请稍后重试。\",\"setup_confirm_error\":\"无法创建该硬盘。没有任何更改——请检查下方的权限后重试。\",\"setup_policy_error\":\"无法加载需要粘贴的权限。\",\"setup_policy_label\":\"显示需要粘贴的确切权限\",\"library_all\":\"全部\",\"library_not_pushable\":\"图片暂时还无法复制到云端。\",\"kind_widget\":\"小组件\",\"kind_markdown\":\"Markdown\",\"kind_html\":\"HTML\",\"kind_json\":\"JSON\",\"kind_svg\":\"SVG\",\"kind_text\":\"文本\",\"kind_webapp\":\"网页应用\",\"kind_image\":\"图片\",\"drive_title\":\"硬盘\",\"drive_upload\":\"上传\",\"drive_uploading\":\"上传中…\",\"drive_bad_name\":\"该文件名包含硬盘无法存储的字符。字母、数字、空格以及 . _ - ( ) + @ = 是安全的。\",\"rename_bad_name\":\"该名称包含硬盘无法存储的字符。请修改名称后重试。\",\"drive_bad_name_named\":\"“{{name}}”无法上传——文件名包含硬盘无法存储的字符。字母、数字、空格以及 . _ - ( ) + @ = 是安全的。\",\"drive_upload_failed\":\"“{{name}}”上传失败，请重试。\",\"section_files\":\"文件\",\"section_library\":\"产物库\",\"section_backup\":\"备份\",\"share_title\":\"分享“{{name}}”\",\"share_expiry\":\"链接过期时间\",\"share_note\":\"备注\",\"share_note_placeholder\":\"这个链接用于做什么？\",\"share_create\":\"创建链接\",\"share_creating\":\"创建中…\",\"share_failed\":\"无法创建分享链接。没有分享任何内容。\",\"expiry_1h\":\"1 小时\",\"expiry_1d\":\"1 天\",\"expiry_7d\":\"7 天\",\"share_expires_note\":\"链接过期后即失效，且无法提前撤回。\",\"share_credentials_caveat\":\"如果账户的登录会话先结束，链接可能会更早失效。\",\"cli_drawer_label\":\"存放位置\",\"cli_drawer_hint\":\"这些文件存放在存储桶 {{bucket}} 中的 {{prefix}} 下。此命令可从拥有你凭证的终端列出这些文件。\",\"backup_title\":\"备份\",\"backup_kind_snapshot\":\"记忆与工作区\",\"backup_kind_sessions\":\"会话存档\",\"backup_last_run\":\"上次备份于 {{when}} · {{size}}\",\"backup_never\":\"尚未备份\",\"backup_never_recorded\":\"此处没有运行记录——较早的档案可能仍在云端硬盘上\",\"backup_remembered\":\"本机已记录的备份档案：{{count}} · 查看列表\",\"backup_sessions_scope\":\"包含此 Kiro 主目录下所有会话的 CLI 回放日志，而不仅是在 {{productName}} 中开始的对话。\",\"backup_run_now\":\"立即备份\",\"backup_running\":\"备份中…\",\"backup_failed\":\"上次备份失败：{{reason}}\",\"backup_start_failed\":\"无法启动备份。\",\"backup_start_retry\":\"无法启动备份，请重试。\",\"backup_start_unavailable\":\"此应用无法使用备份。请检查任务运行时是否已注册。\",\"backup_start_consent\":\"请为此账户授予 S3 访问权限，然后启动备份。\",\"backup_start_no_drive\":\"此账户还没有云盘。请先创建，然后启动备份。\",\"backup_nightly\":\"每晚备份\",\"backup_nightly_hint\":\"每天进行一次记忆与工作区快照。\",\"backup_nightly_blocked_other_account\":\"每晚快照仅针对默认账户运行，因此不会为此账户备份任何内容。\",\"backup_nightly_sessions\":\"每晚备份会话\",\"backup_nightly_sessions_hint\":\"每天将会话存档上传到此账户的云盘一次。其中原样包含你的对话，不会删除任何内容。\",\"backup_nightly_sessions_destination\":\"该云盘是此 AWS 账户中的 S3 存储，{{button}} 也会把存档发送到同一位置。\",\"backup_nightly_sessions_blocked_host\":\"这台计算机无法创建会话存档，因此不会上传任何内容。\",\"backup_nightly_sessions_blocked_redaction\":\"已开启外发内容脱敏，而会话存档暂时无法脱敏，因此不会上传任何内容。\",\"backup_nightly_sessions_blocked_other_account\":\"每晚上传仅针对默认账户运行，因此不会为此账户上传任何内容。\",\"backup_nightly_sessions_blocked_other\":\"此计算机上的每晚上传已暂停，因此不会上传任何内容。\",\"backup_nightly_sessions_blocked_next\":\"你仍然可以自己启动备份。\",\"backup_nightly_sessions_blocked_next_redaction\":\"你仍然可以自己启动备份，但会话存档会不经脱敏直接上传。\",\"backup_archive\":\"已存储的备份\",\"backup_restore\":\"恢复\",\"backup_show_all_archives\":\"显示全部（{{count}}）\",\"backup_restore_caveat\":\"恢复需要对备份文件夹的读取权限。推荐的最小权限策略有意只授予写入权限，因此除非该账户的凭证权限更宽，否则恢复会被拒绝。\",\"backup_remote_error\":\"目前无法读取已存储的备份。\",\"backup_status_failed\":\"无法读取备份状态。\",\"backup_nightly_failed\":\"无法更改“{{setting}}”。设置保持不变。\",\"backup_restore_failed\":\"无法恢复该备份。没有写入任何内容。\",\"backup_restored_note\":\"你当前的数据没有被替换。备份已下载到下方路径的暂存文件夹中。\",\"backup_restore_recovered_note\":\"已下载此安装实例自己上传的版本，并已与它的上传记录核对一致。云盘上的这份存档曾被其他数据覆盖，你下次上传的内容也可能这样被覆盖。请先查看本页列出的、同样备份到此云盘的其他安装实例。\",\"backup_install\":\"此安装实例\",\"backup_install_hint\":\"每个安装实例都用自己名字存放备份，这样恢复时就能区分此安装实例的存档和另一个安装实例的存档。\",\"backup_install_rename\":\"重命名\",\"backup_install_save\":\"保存名称\",\"backup_install_rename_failed\":\"无法保存安装实例名称，名称未更改。\",\"backup_install_name_label\":\"安装实例名称\",\"backup_attribution_self\":\"{{label}} · 此安装实例\",\"backup_attribution_self_unnamed\":\"此安装实例\",\"backup_attribution_other\":\"“{{label}}”（另一个安装实例 · {{id}}）\",\"backup_attribution_other_unnamed\":\"另一个安装实例 · {{id}}\",\"backup_attribution_unverified\":\"来源未核实\",\"backup_origin_unknown\":\"来源未知\",\"backup_none_from_this_install\":\"此安装实例没有备份。包含其他安装实例的存档以查看它们的备份。\",\"backup_others_on_drive\":\"备份到此云盘的其他安装实例：{{count}} 个\",\"backup_show_others\":\"包含其他安装实例的存档\",\"backup_others_truncated\":\"只显示前 {{max}} 个其他安装实例。\",\"backup_archives_truncated\":\"部分{{kind}}存档未能列出，最新的存档可能未显示。\",\"backup_shared_note\":\"两个安装实例共用一个云盘，并不意味着共享记忆或共享会话。每个备份都是某一时刻的独立存档，恢复只是把该文件下载到一个暂存文件夹 — 文件由你自己替换，且需在 gateway 停止时进行。\",\"backup_restore_foreign_confirm\":\"此存档由另一个安装实例（{{install}}）上传。恢复它会下载那个安装实例的数据，而不是此安装实例的数据。仍要下载吗？\",\"backup_restore_unverified_confirm\":\"此存档存放在此安装实例自己的文件夹里，但此安装实例没有上传它的记录。任何能写入云盘的东西都能创建那个文件夹，所以它未必来自此安装实例。仍要下载吗？\",\"backup_restore_unknown_confirm\":\"此存档是在安装实例命名之前上传的，因此无法得知是哪个安装实例写入的。仍要下载吗？\",\"backup_restore_overwritten_confirm\":\"此存档由此安装实例上传，但云盘上现在的内容已不是它当时上传的——后来被其他数据覆盖了。仍要下载吗？\",\"backup_restore_overwritten_refused\":\"此存档由此安装实例上传，但云盘上现在的内容已不是它当时上传的。若仍要下载，请打开“已存储的备份”并选择“下载”。\",\"backup_restore_foreign_refused\":\"该存档属于另一个安装实例。请确认恢复以仍要下载它。\",\"backup_restore_confirm_yes\":\"下载\",\"backup_restore_confirm_no\":\"取消\",\"access_title\":\"分享链接\",\"access_empty\":\"没有活动的分享链接。\",\"access_expires_in\":\"{{when}} 过期\",\"access_forget\":\"从列表移除\",\"access_object_missing\":\"文件已删除\",\"access_unchecked\":\"这些链接尚未与云盘核对，因此已删除的文件不会在此标记。\",\"access_footer\":\"从列表移除链接并不会使其失效——已分享的链接在到期前一直有效。\",\"access_list_failed\":\"无法读取分享链接。\",\"access_forget_failed\":\"无法从列表中移除该链接。它仍在列表中。\",\"keys_count_other\":\"{{count}} 个密钥\",\"keys_for_account\":\"{{name}} 的密钥\",\"key_healthy\":\"正常\",\"parent_folders\":\"上级文件夹\",\"folder_actions\":\"文件夹操作\",\"file_actions\":\"文件操作\",\"root_storage_used\":\"存储占用分布\",\"root_section_objects_other\":\"{{objects}} 项\",\"view_grid\":\"网格视图\",\"view_list\":\"列表视图\",\"library_add\":\"从制品添加\",\"library_add_one\":\"添加到“产物库”\",\"folder_open\":\"打开文件夹 {{name}}\",\"library_adding\":\"正在添加…\",\"library_add_oneway\":\"这里的副本会占用云端存储。\",\"library_add_again\":\"再添加一次\",\"library_add_count\":\"从制品添加（{{count}} 个可用）\",\"library_add_nothing\":\"没有可添加的了 - 能添加的都已经在这里。\",\"library_list_failed\":\"读取云端内容失败。\",\"files_list_failed\":\"无法读取该文件夹。\",\"library_local_failed\":\"无法读取你的产物。\",\"retry\":\"重试\",\"library_add_none\":\"没有匹配的制品。\",\"library_update\":\"更新副本\",\"library_search\":\"搜索你的制品\",\"library_push_failed\":\"无法添加此制品。请重试。\",\"library_blurb\":\"Kiro 为你生成、并复制到云端的内容。你自己上传的文件保存在“文件”中。\",\"library_empty_title\":\"尚未复制任何内容到云端\",\"library_empty_body\":\"此文件夹存放 Kiro 为你生成的内容——小组件、页面、文档——在你把它们复制到云端之后。你从电脑上传的文件应放在“文件”中。\",\"library_cloud_only\":\"仅在云端\",\"library_in_cloud\":\"已在云端\",\"library_stale_preview\":\"云端存的是 v{{version}}；预览显示的是本机较新的副本\",\"library_stale_list\":\"云端副本为 v{{version}}，本地副本更新\",\"library_added\":\"{{when}} 添加\",\"library_open\":\"在产物中打开 {{name}}\",\"files_empty_title\":\"“文件”为空\",\"files_empty_body\":\"此文件夹存放你从电脑上传的文件。它与“产物库”是分开的，“产物库”存放 Kiro 为你生成的内容。\",\"library_remove\":\"移除\",\"library_remove_confirm\":\"从云端库中移除“{{name}}”？\",\"library_remove_confirm_slug\":\"此操作会清空云端文件夹 <folder>{{folder}}</folder>。\",\"library_actions\":\"库项目操作\",\"library_remove_action\":\"移除副本\",\"library_removing\":\"正在移除…\",\"library_remove_failed\":\"移除失败——云端副本未受影响。请重试。\",\"move_conflict\":\"目标文件夹里已有同名文件。请选择其他文件夹，或先给文件改名。\",\"move_shared\":\"该文件有仍在流通的分享链接——移动会使链接失效。请先移除分享（或等它过期）后重试。\",\"rename\":\"重命名\",\"preview_truncated\":\"文件较大，仅显示开头部分。\",\"preview_redacted\":\"预览中已遮蔽敏感值。\",\"preview_unsupported\":\"此类型文件无法预览，请下载后查看。\",\"preview_failed\":\"预览加载失败，请下载后查看，或重试。\",\"search_files\":\"按文件名或路径搜索…\",\"search_clear\":\"清除搜索\",\"search_pending\":\"正在搜索…\",\"search_capped\":\"匹配项过多，仅显示前 {{count}} 条。\",\"search_failed\":\"搜索失败，请重试。\",\"search_goto\":\"打开所在文件夹\",\"move_failed\":\"文件移动失败，请重试。\",\"rename_conflict\":\"此处已有同名文件。\",\"rename_shared\":\"该文件有仍在流通的分享链接——重命名会使链接失效。请先移除分享（或等它过期）后重试。\",\"rename_failed\":\"文件重命名失败，请重试。\",\"rename_failed_named\":\"无法重命名“{{name}}”：{{reason}}\",\"library_add_empty\":\"还没有产物。Kiro 为你生成的内容会出现在这里，可随时复制到云端。\",\"move_to\":\"移动到文件夹…\",\"move_title\":\"将“{{name}}”移动到\",\"move_root\":\"文件（顶层）\",\"move_up\":\"上移到 {{name}}\",\"move_no_folders\":\"这里没有其他可移入的文件夹。请先创建一个。\",\"move_moving\":\"正在移动…\",\"move_moving_picker\":\"正在移动…关闭此窗口不会取消移动。\",\"move_to_busy\":\"另一个移动仍在进行\",\"move_ask_agent\":\"就这次移动询问代理\",\"stat_storage\":\"存储\",\"stat_objects\":\"对象\",\"key_needs_attention\":\"需要处理\",\"backup_state_current\":\"已备份\",\"backup_state_never\":\"从未运行\",\"costs_refresh_failed\":\"最新一次账单读取失败，显示的是缓存数值。\"},\"page\":{\"refresh\":\"刷新\",\"health_ok\":\"正常\",\"health_degraded\":\"需要处理\",\"health_unknown\":\"未知\",\"kind_sso\":\"SSO\",\"kind_credential_process\":\"凭证进程\",\"kind_other\":\"其他\",\"default_profile\":\"默认配置\",\"not_connected_yet\":\"尚未连接\",\"reconnect\":\"重新连接\",\"reconnect_loading\":\"正在加载重新连接指引…\",\"reconnect_error\":\"无法加载重新连接指引。\",\"reconnect_hint_sso\":\"重新登录以刷新此连接，然后刷新本页面。\",\"reconnect_hint_credential_process\":\"在终端中运行此命令以更新凭证，然后刷新本页面。\",\"reconnect_hint_other\":\"在终端中运行此命令以恢复连接，然后刷新本页面。\",\"copy\":\"复制\",\"copied\":\"已复制\",\"empty_title\":\"还没有账户\",\"empty_body\":\"在下方“添加账户”中注册本机的一个 AWS 配置文件，其账户就会显示在这里。\",\"error_title\":\"无法加载你的账户。\",\"error_body\":\"读取账户列表时出错。请稍后重试。\",\"error_forbidden_body\":\"当前控制台会话不是所有者的会话，无法管理 AWS 账户。请以所有者身份登录后重试。\",\"retry\":\"重试\",\"disabled_title\":\"AWS Control 已关闭\",\"disabled_body\":\"在 App Store 中启用此应用即可查看你的账户。\",\"aggregate_accounts_other\":\"{{count}} 个账户\",\"aggregate_keys_other\":\"{{count}} 个密钥\",\"aggregate_healthy_other\":\"{{count}} 个正常\",\"keys_summary_other\":\"{{count}} 个密钥\",\"add_accounts_title\":\"添加账户\",\"add_accounts_summary\":\"注册本机更多的 AWS 配置文件\",\"add_accounts_intro\":\"这些本地 AWS 配置文件尚未注册。你添加的每一个都会成为其账户下的一个密钥。\",\"add_accounts_search_placeholder\":\"搜索配置文件\",\"add_accounts_search_keeps_selected\":\"你选中的配置文件即使不匹配也会留在列表里。\",\"add_accounts_none\":\"所有本地配置文件都已注册。\",\"add_accounts_no_profiles\":\"本机还没有 AWS 配置文件。请先创建一个（例如在终端中运行 aws configure），然后在这里注册。\",\"add_accounts_unsupported\":\"在 Windows 上，AWS Control 无法访问本机的 AWS 配置文件：访问 AWS 需要 Linux 或 macOS shell。请在 WSL (Windows Subsystem for Linux) 中运行 {{productName}} 网关，然后注册你在其中配置的 AWS 配置文件。\",\"add_accounts_count_other\":\"已注册 {{count}} / {{max}}\",\"add_accounts_cap_reached\":\"已达到 {{max}} 个密钥的上限。请先移除一个再添加。\",\"add_accounts_register\":\"注册所选\",\"add_accounts_registering\":\"正在注册…\",\"add_accounts_error\":\"无法注册这些配置文件。没有添加任何内容。请重试。\",\"add_accounts_load_error\":\"无法列出本地 AWS 配置文件。\",\"search_placeholder\":\"搜索账户\",\"paid_services_title\":\"付费服务\",\"orphan_consent\":\"已为一个未在此注册的 AWS 账号确认。可在下方撤回确认，或重新注册该账号以在它自己的页面上管理。\",\"account_actions\":\"账户操作\",\"remove_account\":\"从 AWS Control 移除…\",\"remove_account_action\":\"移除\",\"remove_account_confirm\":\"从 AWS Control 移除“{{name}}”？AWS 和你的 AWS CLI 配置不会有任何改动。\",\"remove_account_error\":\"无法移除该账户。\",\"remove_account_hint\":\"AWS 中不会有任何改动\",\"forget_key_confirm\":\"忘记这一行的密钥“{{name}}”？AWS 和你的 AWS CLI 配置不会有任何改动。\",\"forget_key_action\":\"忘记密钥\",\"totals_summary_other\":\"{{accounts}} 个账户 · {{keys}}\",\"keys_healthy_other\":\"{{n}} 个密钥中 {{healthy}} 个正常\"},\"rail\":{\"accounts\":\"账户与凭证\",\"nav\":\"AWS Control 区域\",\"switch_account\":\"切换账户\",\"usage\":\"用量与费用\",\"use_account\":\"使用此账户\"},\"overview\":{\"title\":\"概览\",\"subtitle\":\"在一个地方管理智能体可以使用的账户、密钥、云盘和付费服务。\",\"stat_accounts\":\"账户\",\"stat_accounts_attention_other\":\"{{count}} 个需要处理\",\"stat_accounts_all_ok\":\"全部正常\",\"stat_keys\":\"密钥正常\",\"stat_keys_sub_other\":\"已登记 {{count}} 个密钥\",\"stat_drive\":\"云盘用量\",\"stat_drive_none\":\"尚无云盘\",\"stat_spend\":\"本月至今\",\"stat_spend_consent\":\"费用报告已关闭\",\"stat_shares_none\":\"没有共享\",\"stat_shares_sub_other\":\"{{count}} 个有效链接\",\"stat_backups_nightly\":\"每晚\",\"stat_backups_manual\":\"手动\",\"stat_backups_sub_nightly\":\"每晚运行\",\"stat_backups_sub_manual\":\"未设置计划\",\"accounts_title\":\"账户\",\"accounts_note\":\"智能体使用这些密钥但永远看不到它们，密钥内容不会出现在聊天中。\",\"add_account\":\"添加账户\",\"drive_title\":\"云盘\",\"drive_bar_label\":\"已存储 {{size}}，分布在文件、工件库和备份中\",\"drive_empty_title\":\"尚无云盘\",\"drive_empty_body\":\"在此账户中创建一个私有加密存储桶，用于存放文件、工件库和备份。\",\"drive_setup\":\"设置云盘\",\"drive_bucket_label\":\"存储桶\",\"stat_spend_scope\":\"此账户的 AWS 账单\"}}}"),
		components: {
			"awsConsentGate": {
				"confirm_title": "首次请求前确认 AWS 用量",
				"confirmed_title": "已确认 AWS 用量",
				"account_changed": "此前确认的是另一个 AWS 账号，因此确认已被撤销。请核对下方账号后重新确认。",
				"service": "服务",
				"region": "区域",
				"credential_source": "凭证来源",
				"aws_account": "AWS 账号",
				"provider_default": "（服务方默认值）",
				"unresolved_account": "无法解析",
				"billing_notice": "这是付费 AWS 服务。在你确认之前不会发送任何请求。",
				"confirm_button": "确认并启用",
				"withdraw": "撤销确认",
				"status_failed": "无法读取确认状态。",
				"confirm_failed": "确认未被记录。",
				"withdraw_failed": "确认未被撤销。",
				"retry": "重试",
				"badge_confirmed": "已确认",
				"badge_not_enabled": "未启用",
				"confirmed_on": "已于 {{date}} 确认",
				"billing_notice_short": "会产生费用。确认前不会发送任何内容。",
				"pending_profile_hint": "完成 AWS 配置文件的输入后即可确认。",
				"bedrock_kb_billing_short": "每次搜索计费：每个 Knowledge Base 调用一次 Bedrock Retrieve",
				"aws_pricing_link": "AWS 定价",
				"withdraw_effect": "撤回后，智能体将停止使用此服务，直到你再次确认。"
			},
			"ui": {
				"clear_filter": "清除筛选",
				"no_matches_for": "没有匹配",
				"no_noun_match": "没有匹配的{{noun}}"
			}
		}
	}
};
var own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function lookup(catalog, key) {
	let node = catalog;
	for (const part of key.split(".")) {
		if (node === void 0 || typeof node === "string" || !own(node, part)) return void 0;
		node = node[part];
	}
	return typeof node === "string" ? node : void 0;
}
/** The catalogs to try for `locale`, most specific first, always ending in English. */
function localeChain(locale) {
	const chain = [];
	const add = (candidate) => {
		if (own(CATALOGS, candidate) && !chain.includes(candidate)) chain.push(candidate);
	};
	add(locale);
	add(locale.split("-")[0]);
	add("en");
	return chain;
}
function currentLocale() {
	try {
		const locale = activeLocale();
		return typeof locale === "string" && locale ? locale : "en";
	} catch {
		return "en";
	}
}
var PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
var pluralRules = /* @__PURE__ */ new Map();
function pluralCategory(locale, count) {
	let rules = pluralRules.get(locale);
	if (!rules) {
		rules = new Intl.PluralRules(locale);
		pluralRules.set(locale, rules);
	}
	return rules.select(count);
}
/** The keys to try in `locale`'s catalog, most specific first. */
function candidates(locale, key, vars) {
	const count = vars && own(vars, "count") ? vars.count : void 0;
	if (typeof count !== "number" || !Number.isFinite(count)) return [key];
	const forms = [`${key}_${pluralCategory(locale, count)}`, key];
	return count === 0 ? [`${key}_zero`, ...forms] : forms;
}
function t(key, vars) {
	for (const locale of localeChain(currentLocale())) {
		let text;
		for (const candidate of candidates(locale, key, vars)) {
			text = lookup(CATALOGS[locale], candidate);
			if (text !== void 0) break;
		}
		if (text !== void 0) return text.replace(PLACEHOLDER, (whole, name) => vars && own(vars, name) ? String(vars[name]) : whole);
	}
	return key;
}
/** The built-in's spelling of `t`, so the ported call sites read unchanged. */
var i18nT = t;
// src/host/ui.tsx
/**
* The dashboard primitives this page renders, from the App SDK where it has them.
*
* `@kirocrew/app-sdk/ui` serves the host's own components (one set of styles for
* every app). The four the SDK does not export are restated here from the
* dashboard's `components/ui.tsx` with the same markup and class strings, minus the
* host-only behaviour each carried: `IconButton`'s instant label tip (the native
* `title` / `aria-label` remain) and the guide's auto-site ref.
*/
function join(...parts) {
	return parts.filter(Boolean).join(" ");
}
var ICON_BUTTON_VARIANTS = {
	default: "text-muted hover:text-text hover:bg-bg-hover",
	accent: "text-muted hover:text-accent hover:bg-bg-hover",
	danger: "text-muted hover:text-danger-text hover:bg-danger-subtle",
	active: "text-accent hover:bg-bg-hover"
};
var IconButton = React.forwardRef(({ variant = "default", className, children, ...rest }, ref) => /* @__PURE__ */ jsx("button", {
	ref,
	type: "button",
	title: rest.title === void 0 ? rest["aria-label"] : rest.title,
	className: join("p-[4px] rounded transition-all active:scale-[0.97] active:duration-75 cursor-pointer bg-transparent border-none disabled:opacity-30 disabled:cursor-not-allowed", ICON_BUTTON_VARIANTS[variant], className),
	...rest,
	children
}));
IconButton.displayName = "IconButton";
function FilteredEmpty({ query, onClear, noun, testId = "filtered-empty" }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col items-center justify-center py-8 gap-1.5 animate-rise",
		"data-testid": testId,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "text-muted text-sm",
			children: [
				noun ? i18nT("components.ui.no_noun_match", { noun }) : i18nT("components.ui.no_matches_for"),
				" ",
				/* @__PURE__ */ jsxs("span", {
					className: "font-medium text-text",
					children: [
						"“",
						query,
						"”"
					]
				})
			]
		}), /* @__PURE__ */ jsx("button", {
			onClick: onClear,
			className: "text-accent text-[13px] hover:underline cursor-pointer bg-transparent border-none p-0",
			"data-testid": `${testId}-clear`,
			children: i18nT("components.ui.clear_filter")
		})]
	});
}
function PanelSectionHeader({ label, count, trailing, className }) {
	return /* @__PURE__ */ jsxs("div", {
		className: join("flex items-center gap-2", className),
		"data-testid": "panel-section-header",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "text-[11.5px] font-semibold text-muted",
				children: label
			}),
			count !== void 0 && /* @__PURE__ */ jsx("span", {
				className: "text-[10.5px] text-muted font-mono tabular-nums",
				children: count
			}),
			/* @__PURE__ */ jsx("span", { className: "flex-1 h-px bg-border" }),
			trailing
		]
	});
}
/** Bare themed checkbox. Pairs with a caller-supplied label. */
var Checkbox = React.forwardRef(({ style, ...rest }, ref) => /* @__PURE__ */ jsx("input", {
	ref,
	type: "checkbox",
	style: {
		margin: 0,
		accentColor: "var(--accent)",
		cursor: "pointer",
		...style
	},
	...rest
}));
Checkbox.displayName = "Checkbox";
// src/host/dropdown.tsx
/**
* The small dropdown menu the page's row and crumb menus use.
*
* The dashboard's `components/ui/dropdown-menu.tsx` wraps Radix and its guide and
* overlay plumbing, none of which is on the App SDK, so this restates the part the
* page relies on with the same names and props:
*
* - the trigger (`asChild`) opens on a primary pointer press or Enter / Space /
*   ArrowDown, toggles on a keyboard click, and carries `aria-haspopup`,
*   `aria-expanded` and `data-state`;
* - the content is a `role="menu"` list aligned to the trigger's start or end edge;
*   it closes on Escape, on a press outside it, or after an item is chosen;
* - an item is a `role="menuitem"` button whose `onSelect(event)` runs on click;
*   calling `event.preventDefault()` keeps the menu open, as in Radix;
* - on close focus goes back to the trigger, unless `onCloseAutoFocus` prevents it
*   (the page does that when the item opened a dialog that takes focus itself).
*
* It does not render into a portal or flip near the viewport edge (PORTING.md,
* "Menus").
*/
var MenuContext = createContext(null);
function useMenu() {
	const state = useContext(MenuContext);
	if (!state) throw new Error("DropdownMenu parts must be inside <DropdownMenu>");
	return state;
}
function DropdownMenu({ children, open: openProp, onOpenChange }) {
	const [ownOpen, setOwnOpen] = useState(false);
	const open = openProp ?? ownOpen;
	const triggerRef = useRef(null);
	const closeAutoFocus = useRef(void 0);
	const contentId = useId();
	const setOpen = useCallback((next) => {
		if (openProp === void 0) setOwnOpen(next);
		onOpenChange?.(next);
		if (!next) {
			const event = new Event("dropdown.closeAutoFocus", { cancelable: true });
			closeAutoFocus.current?.(event);
			if (!event.defaultPrevented) {
				const trigger = triggerRef.current;
				setTimeout(() => trigger?.focus({ preventScroll: true }), 0);
			}
		}
	}, [openProp, onOpenChange]);
	const value = useMemo(() => ({
		open,
		setOpen,
		triggerRef,
		contentId,
		closeAutoFocus
	}), [
		open,
		setOpen,
		contentId
	]);
	return /* @__PURE__ */ jsx(MenuContext.Provider, {
		value,
		children: /* @__PURE__ */ jsx("span", {
			className: "relative inline-flex",
			children
		})
	});
}
function DropdownMenuTrigger({ children, asChild }) {
	const menu = useMenu();
	const pointerOpened = useRef(false);
	const child = Children.only(children);
	const element = asChild && isValidElement(child) ? child : /* @__PURE__ */ jsx("button", {
		type: "button",
		children
	});
	const own = element.props;
	return cloneElement(element, {
		ref: (node) => {
			menu.triggerRef.current = node;
		},
		"aria-haspopup": "menu",
		"aria-expanded": menu.open,
		"aria-controls": menu.open ? menu.contentId : void 0,
		"data-state": menu.open ? "open" : "closed",
		onPointerDown: (event) => {
			own.onPointerDown?.(event);
			if (event.defaultPrevented || (event.button ?? 0) !== 0 || event.ctrlKey) return;
			pointerOpened.current = true;
			menu.setOpen(!menu.open);
			event.preventDefault();
		},
		onClick: (event) => {
			own.onClick?.(event);
			if (pointerOpened.current) {
				pointerOpened.current = false;
				return;
			}
			if (!event.defaultPrevented) menu.setOpen(!menu.open);
		},
		onKeyDown: (event) => {
			own.onKeyDown?.(event);
			if (event.defaultPrevented) return;
			if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
				event.preventDefault();
				menu.setOpen(true);
			}
		}
	});
}
function DropdownMenuContent({ children, align = "center", className = "", onCloseAutoFocus, ...rest }) {
	const menu = useMenu();
	const ref = useRef(null);
	menu.closeAutoFocus.current = onCloseAutoFocus;
	const { open, setOpen, triggerRef } = menu;
	useEffect(() => {
		if (!open) return;
		(ref.current?.querySelector("[role=\"menuitem\"]:not([disabled])"))?.focus({ preventScroll: true });
		const onPointer = (event) => {
			const target = event.target;
			if (!target) return;
			if (ref.current?.contains(target) || triggerRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKey = (event) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointer, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointer, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [
		open,
		setOpen,
		triggerRef
	]);
	if (!open) return null;
	const side = align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";
	const onKeyDown = (event) => {
		rest.onKeyDown?.(event);
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		const items = Array.from(ref.current?.querySelectorAll("[role=\"menuitem\"]:not([disabled])") ?? []);
		if (!items.length) return;
		event.preventDefault();
		items[(items.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
	};
	return /* @__PURE__ */ jsx("div", {
		...rest,
		ref,
		id: menu.contentId,
		role: "menu",
		onKeyDown,
		className: `absolute top-full mt-1 ${side} z-50 min-w-[10rem] rounded-lg border border-border bg-card p-1 shadow-lg ${className}`,
		children
	});
}
function DropdownMenuItem({ children, onSelect, disabled, className = "", ...rest }) {
	const menu = useMenu();
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		role: "menuitem",
		disabled,
		"aria-disabled": disabled || void 0,
		"data-disabled": disabled ? "" : void 0,
		...rest,
		className: `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-text bg-transparent border-none cursor-pointer hover:bg-bg-hover focus:bg-bg-hover focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`,
		onClick: (event) => {
			rest.onClick?.(event);
			if (disabled) return;
			const selectEvent = new Event("dropdown.select", { cancelable: true });
			onSelect?.(selectEvent);
			if (!selectEvent.defaultPrevented) menu.setOpen(false);
		},
		children
	});
}
function DropdownMenuSeparator({ className = "" }) {
	return /* @__PURE__ */ jsx("div", {
		role: "separator",
		className: `my-1 h-px bg-border ${className}`
	});
}
// src/host/coreApi.ts
var CONSENT = "/api/apps/aws-control/consent";
async function json(res) {
	const text = await res.text();
	let body = {};
	try {
		body = text ? JSON.parse(text) : {};
	} catch {
		body = {};
	}
	if (!res.ok) {
		const reported = body && typeof body === "object" ? body.error : void 0;
		const message = typeof reported === "string" && reported ? reported : `HTTP ${res.status}`;
		const err = new Error(message);
		err.status = res.status;
		err.body = body;
		throw err;
	}
	return body;
}
function send(method, url, body) {
	return fetch(url, {
		method,
		credentials: "same-origin",
		headers: body === void 0 ? void 0 : { "Content-Type": "application/json" },
		body: body === void 0 ? void 0 : JSON.stringify(body)
	});
}
var api = {
	awsConsent: (service, target) => send("GET", `${CONSENT}?service=${encodeURIComponent(service)}` + (target && typeof target.profile === "string" && typeof target.region === "string" ? `&profile=${encodeURIComponent(target.profile)}&region=${encodeURIComponent(target.region)}` : "")).then((res) => json(res)),
	grantAwsConsent: (service, shown, target) => send("POST", CONSENT, {
		service,
		expectedProfile: shown.profile,
		expectedRegion: shown.region,
		expectedAccount: shown.account,
		...target ? {
			targetProfile: target.profile,
			targetRegion: target.region
		} : {}
	}).then((res) => json(res)),
	revokeAwsConsent: (service) => send("DELETE", `${CONSENT}?service=${encodeURIComponent(service)}`).then((res) => json(res))
};
// src/host/format.ts
/**
* Locale-aware formatting, from the App SDK (`fmtNumber`, `fmtCurrency`, `fmtDate`,
* `fmtRelative`). `fmtBytes` is not on the SDK, so it is restated here from the
* dashboard's `i18n/format.ts`, over the SDK's `fmtNumber`: decimal units (kB, MB,
* GB, TB) in the narrow unit style, with every plain space made non-breaking so a
* quantity never wraps between the number and its unit.
*/
function fmtUnit(value, unit, options) {
	if (!Number.isFinite(value)) return "—";
	return fmtNumber(value, {
		style: "unit",
		unit,
		unitDisplay: "narrow",
		...options
	}).replace(/ /g, "\xA0");
}
function roundToDigits(value, digits) {
	const step = 10 ** digits;
	return Math.sign(value) * Math.round(Math.abs(value) * step) / step;
}
function fmtBytes(bytes, options) {
	if (!Number.isFinite(bytes)) return "—";
	const digits = options?.maximumFractionDigits;
	const b = roundToDigits(bytes, digits ?? 0);
	if (Math.abs(b) < 1e3) return fmtUnit(b, "byte", {
		maximumFractionDigits: 0,
		...options
	});
	const kb = roundToDigits(bytes / 1e3, digits ?? 1);
	if (Math.abs(kb) < 1e3) return fmtUnit(kb, "kilobyte", {
		maximumFractionDigits: 1,
		...options
	});
	const mb = roundToDigits(bytes / 1e3 ** 2, digits ?? 1);
	if (Math.abs(mb) < 1e3) return fmtUnit(mb, "megabyte", {
		maximumFractionDigits: 1,
		...options
	});
	const gb = roundToDigits(bytes / 1e3 ** 3, digits ?? 1);
	if (Math.abs(gb) < 1e3) return fmtUnit(gb, "gigabyte", {
		maximumFractionDigits: 1,
		...options
	});
	return fmtUnit(bytes / 1e3 ** 4, "terabyte", {
		maximumFractionDigits: 1,
		...options
	});
}
// src/host/AwsConsentGate.tsx
/**
* Confirmation gate for a paid AWS service (Amazon Polly, Amazon Transcribe).
*
* Renders inline in the settings card rather than as a blocking modal, and that
* is deliberate: the confirmation is durable state the operator should be able
* to SEE and withdraw at any time, not a one-shot dialog that disappears once
* answered. A modal would also have nowhere to live for the case that matters
* most -- a grant that was revoked automatically because the account changed.
*
* The three facts the issue asks for (service, region, credential source) come
* from the backend along with the account it actually resolves to, because only
* the backend can run the identity probe. Nothing here decides anything: the
* backend refuses to record a confirmation it cannot attach an account to, so
* this component cannot manufacture consent by rendering a button.
*
* `onConsentChange` exists because a grant gates data this component cannot
* name. It invalidates its own status, while callers invalidate only the
* service-specific surfaces they own. The AWS Control console, for example,
* decides whether to show the ask from a cached 409 on the drive read and from
* `costs.consentMissing`. Without a way to invalidate those too, withdrawing
* leaves the operator with no receipt, no ask, and a stale drive row: nothing
* on screen offers the confirm back. Callers whose surfaces do not depend on a
* grant omit it.
*/
function AwsConsentGate({ service, onConsentChange, compact = false, askAgent = false, target, targetPending = false }) {
	const qc = useQueryClient();
	const consentQ = useQuery({
		queryKey: target ? [
			"awsConsent",
			service,
			target.profile,
			target.region
		] : ["awsConsent", service],
		queryFn: () => target ? api.awsConsent(service, target) : api.awsConsent(service),
		enabled: !targetPending
	});
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["awsConsent", service] });
		onConsentChange?.();
	};
	const grantMut = useMutation({
		mutationFn: () => {
			const shown = {
				profile: consentQ.data?.profile ?? "",
				region: consentQ.data?.region ?? "",
				account: consentQ.data?.account ?? ""
			};
			return target ? api.grantAwsConsent(service, shown, target) : api.grantAwsConsent(service, shown);
		},
		onSettled: invalidate
	});
	const revokeMut = useMutation({
		mutationFn: () => api.revokeAwsConsent(service),
		onSettled: invalidate
	});
	const rowClass = "flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-[13px]";
	const rowTextClass = "min-w-0 flex-1 basis-[12rem]";
	const billingShort = service === "bedrock-kb" ? i18nT("components.awsConsentGate.bedrock_kb_billing_short") : i18nT("components.awsConsentGate.billing_notice_short");
	if (targetPending) {
		const cachedLabel = qc.getQueriesData({ queryKey: ["awsConsent", service] }).map(([, data]) => data?.serviceLabel).find(Boolean);
		return /* @__PURE__ */ jsxs("div", {
			className: rowClass,
			"data-testid": "aws-consent-" + service,
			"aria-disabled": "true",
			children: [
				/* @__PURE__ */ jsx(Receipt, {
					className: "h-3.5 w-3.5 shrink-0 text-muted",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: rowTextClass,
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "truncate font-medium text-text-strong",
							"data-testid": "aws-consent-" + service + "-title",
							children: cachedLabel || i18nT("components.awsConsentGate.confirm_title")
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-0.5 text-[12px] text-muted",
							children: billingShort
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-0.5 text-[12px] text-muted",
							"data-testid": "aws-consent-" + service + "-pending-hint",
							children: i18nT("components.awsConsentGate.pending_profile_hint")
						})
					]
				}),
				/* @__PURE__ */ jsx(Badge, {
					variant: "muted",
					children: i18nT("components.awsConsentGate.badge_not_enabled")
				})
			]
		});
	}
	if (consentQ.isError) {
		const notice = /* @__PURE__ */ jsx(ui_default$1, {
			message: consentQ.error instanceof Error ? consentQ.error.message : String(consentQ.error),
			title: i18nT("components.awsConsentGate.status_failed"),
			askAgent,
			variant: compact ? "inline" : "block",
			className: "w-full",
			testId: "aws-consent-" + service + "-error"
		});
		const retry = /* @__PURE__ */ jsxs(Btn, {
			onClick: () => consentQ.refetch(),
			"data-testid": "aws-consent-" + service + "-error-retry",
			children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("components.awsConsentGate.retry")]
		});
		if (compact) return /* @__PURE__ */ jsxs("div", {
			className: rowClass,
			"data-testid": "aws-consent-" + service + "-error-card",
			children: [/* @__PURE__ */ jsx("div", {
				className: rowTextClass,
				children: notice
			}), retry]
		});
		return /* @__PURE__ */ jsxs("div", {
			className: "flex flex-col items-start gap-2",
			"data-testid": "aws-consent-" + service + "-error-card",
			children: [notice, retry]
		});
	}
	if (!consentQ.isSuccess) return null;
	const c = consentQ.data;
	const busy = grantMut.isPending || revokeMut.isPending;
	const writeError = grantMut.error ?? revokeMut.error;
	const writeNotice = (className) => writeError ? /* @__PURE__ */ jsx(ui_default$1, {
		message: writeError instanceof Error ? writeError.message : String(writeError),
		title: i18nT(grantMut.error ? "components.awsConsentGate.confirm_failed" : "components.awsConsentGate.withdraw_failed"),
		askAgent,
		className,
		testId: "aws-consent-" + service + "-write-error"
	}) : null;
	const region = c.region || i18nT("components.awsConsentGate.provider_default");
	const accountText = (c.identityResolved ? c.account : c.grant?.account || "") || i18nT("components.awsConsentGate.unresolved_account");
	const sep = /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		children: "·"
	});
	if (compact && c.granted && !c.revokedOnAccountChange) return /* @__PURE__ */ jsxs("div", {
		className: rowClass,
		"data-testid": "aws-consent-" + service,
		children: [
			/* @__PURE__ */ jsx(ShieldCheck, {
				className: "h-3.5 w-3.5 shrink-0 text-ok",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: rowTextClass,
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "truncate font-medium text-text-strong",
						children: c.serviceLabel
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted",
						children: [
							/* @__PURE__ */ jsxs("span", { children: [
								i18nT("components.awsConsentGate.aws_account"),
								" ",
								/* @__PURE__ */ jsx("span", {
									className: "font-mono",
									"data-testid": "aws-consent-account",
									children: accountText
								})
							] }),
							sep,
							/* @__PURE__ */ jsx("span", {
								className: "min-w-0 truncate font-mono",
								"data-testid": "aws-consent-source",
								children: c.credentialSource
							}),
							c.grant?.granted_at && /* @__PURE__ */ jsxs(Fragment$1, { children: [sep, /* @__PURE__ */ jsx("span", {
								"data-testid": "aws-consent-granted-at",
								children: i18nT("components.awsConsentGate.confirmed_on", { date: fmtDate(c.grant.granted_at) })
							})] })
						]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-0.5 text-[12px] text-muted",
						"data-testid": "aws-consent-withdraw-effect",
						children: i18nT("components.awsConsentGate.withdraw_effect")
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ jsx(Badge, {
					variant: "ok",
					children: i18nT("components.awsConsentGate.badge_confirmed")
				}), /* @__PURE__ */ jsx(Btn, {
					danger: true,
					disabled: busy,
					onClick: () => revokeMut.mutate(),
					"data-testid": "aws-consent-" + service + "-withdraw",
					children: i18nT("components.awsConsentGate.withdraw")
				})]
			}),
			writeNotice("basis-full")
		]
	});
	if (compact && !c.granted) return /* @__PURE__ */ jsxs("div", {
		className: rowClass,
		"data-testid": "aws-consent-" + service,
		children: [
			/* @__PURE__ */ jsx(Receipt, {
				className: "h-3.5 w-3.5 shrink-0 text-muted",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: rowTextClass,
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "truncate font-medium text-text-strong",
						children: c.serviceLabel
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted",
						children: [
							/* @__PURE__ */ jsx("span", {
								"data-testid": "aws-consent-billing-short",
								children: billingShort
							}),
							sep,
							/* @__PURE__ */ jsxs("span", { children: [
								i18nT("components.awsConsentGate.aws_account"),
								" ",
								/* @__PURE__ */ jsx("span", {
									className: "font-mono",
									"data-testid": "aws-consent-account",
									children: accountText
								})
							] }),
							sep,
							/* @__PURE__ */ jsx("span", { children: region }),
							sep,
							/* @__PURE__ */ jsx("span", {
								className: "min-w-0 truncate font-mono",
								"data-testid": "aws-consent-source",
								children: c.credentialSource
							})
						]
					}),
					service === "bedrock-kb" && /* @__PURE__ */ jsx("div", {
						className: "mt-0.5 text-[12px] text-muted",
						"data-testid": "aws-consent-billing-detail",
						children: /* @__PURE__ */ jsx("a", {
							href: "https://aws.amazon.com/bedrock/pricing/",
							target: "_blank",
							rel: "noopener noreferrer",
							className: "underline",
							children: i18nT("components.awsConsentGate.aws_pricing_link")
						})
					}),
					c.revokedOnAccountChange && /* @__PURE__ */ jsx("div", {
						className: "mt-0.5 text-[12px] text-warn",
						"data-testid": "aws-consent-account-changed",
						children: i18nT("components.awsConsentGate.account_changed")
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ jsx(Badge, {
					variant: "muted",
					children: i18nT("components.awsConsentGate.badge_not_enabled")
				}), /* @__PURE__ */ jsx(Btn, {
					primary: true,
					disabled: busy || !c.identityResolved,
					onClick: () => grantMut.mutate(),
					"data-testid": "aws-consent-" + service + "-confirm",
					children: i18nT("components.awsConsentGate.confirm_button")
				})]
			}),
			!c.identityResolved && c.identityDetail ? /* @__PURE__ */ jsx(ui_default$1, {
				variant: "inline",
				className: "basis-full",
				askAgent,
				testId: "aws-consent-identity-error",
				message: c.identityDetail
			}) : null,
			writeNotice("basis-full")
		]
	});
	return /* @__PURE__ */ jsxs(Card, {
		className: "mb-0" + (c.granted ? "" : " border-warn"),
		"data-testid": "aws-consent-" + service,
		children: [
			/* @__PURE__ */ jsxs(CardTitle, { children: [/* @__PURE__ */ jsx(ShieldCheck, {
				className: "h-3.5 w-3.5 shrink-0 " + (c.granted ? "text-ok" : "text-accent"),
				"aria-hidden": "true"
			}), c.granted ? i18nT("components.awsConsentGate.confirmed_title") : i18nT("components.awsConsentGate.confirm_title")] }),
			c.revokedOnAccountChange ? /* @__PURE__ */ jsx("p", {
				className: "mb-2 text-[13px] text-warn",
				children: i18nT("components.awsConsentGate.account_changed")
			}) : null,
			/* @__PURE__ */ jsxs("dl", {
				className: "mb-3 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]",
				children: [
					/* @__PURE__ */ jsx("dt", {
						className: "text-[12px] text-muted",
						children: i18nT("components.awsConsentGate.service")
					}),
					/* @__PURE__ */ jsx("dd", {
						className: "mb-1 min-w-0 break-all text-[13px] text-text sm:mb-0",
						children: c.serviceLabel
					}),
					/* @__PURE__ */ jsx("dt", {
						className: "text-[12px] text-muted",
						children: i18nT("components.awsConsentGate.region")
					}),
					/* @__PURE__ */ jsx("dd", {
						className: "mb-1 min-w-0 break-all text-[13px] text-text sm:mb-0",
						children: region
					}),
					/* @__PURE__ */ jsx("dt", {
						className: "text-[12px] text-muted",
						children: i18nT("components.awsConsentGate.credential_source")
					}),
					/* @__PURE__ */ jsx("dd", {
						className: "mb-1 min-w-0 break-all font-mono text-[13px] text-text sm:mb-0",
						"data-testid": "aws-consent-source",
						children: c.credentialSource
					}),
					/* @__PURE__ */ jsx("dt", {
						className: "text-[12px] text-muted",
						children: i18nT("components.awsConsentGate.aws_account")
					}),
					/* @__PURE__ */ jsx("dd", {
						className: "min-w-0 break-all font-mono text-[13px] text-text",
						"data-testid": "aws-consent-account",
						children: accountText
					})
				]
			}),
			!c.identityResolved && c.identityDetail && !c.granted ? /* @__PURE__ */ jsx(ui_default$1, {
				variant: "inline",
				className: "mb-2",
				askAgent,
				testId: "aws-consent-identity-error",
				message: c.identityDetail
			}) : null,
			c.granted ? /* @__PURE__ */ jsx(Btn, {
				danger: true,
				disabled: busy,
				onClick: () => revokeMut.mutate(),
				"data-testid": "aws-consent-" + service + "-withdraw",
				children: i18nT("components.awsConsentGate.withdraw")
			}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("p", {
				className: "mb-2 text-[13px] text-muted",
				children: i18nT("components.awsConsentGate.billing_notice")
			}), /* @__PURE__ */ jsx(Btn, {
				primary: true,
				disabled: busy || !c.identityResolved,
				onClick: () => grantMut.mutate(),
				"data-testid": "aws-consent-" + service + "-confirm",
				children: i18nT("components.awsConsentGate.confirm_button")
			})] }),
			writeNotice("mt-2")
		]
	});
}
// src/host/subNavParams.ts
/** Apple-HIG 44pt touch target, gated to coarse pointers so desktop density
*  is unchanged. One definition — the same rule expressed twice had already
*  drifted (one call site unconditional, one gated). */
var COARSE_TOUCH_TARGET = "[@media(pointer:coarse)]:min-h-11";
/** Parse the pathname under `basePath` into POSITIONAL segments:
*  segment[0] = tab, segment[1] = a SubNav's second-level selection, deeper
*  reserved. Positional means an empty segment (double slash, trailing slash)
*  stays in place as `''` — never matching a key — instead of letting deeper
*  segments shift forward (`/settings/channels//slack` must NOT open the
*  slack pane). Segments are percent-DECODED so keys round-trip through
*  toPathSegment; a malformed escape decodes to itself (still matches no key,
*  so it falls back exactly like any unknown value). Empty when the location
*  is outside the base — e.g. for one render during a cross-page navigate
*  before the consumer unmounts. */
function parsePathSegments(basePath, pathname) {
	if (pathname === basePath) return [];
	if (!pathname.startsWith(basePath + "/")) return [];
	return pathname.slice(basePath.length + 1).split("/").map((seg) => {
		try {
			return decodeURIComponent(seg);
		} catch {
			return seg;
		}
	});
}
/** history.state marker set on entries MINTED BY A DRILL-IN PUSH (root -> tab,
*  list -> pane). The matching back control checks it to decide between a real
*  `history.back()` (entry is ours: popping keeps push/pop symmetric, so the
*  platform back gesture never lands on a dead duplicate entry) and a
*  replace-write (cold deep link: `back()` would exit the app entirely). */
var SUBNAV_PUSH_STATE = "subnavPush";
// src/host/NavBackBar.tsx
/** The iOS-style navigation back bar, shared by EVERY level of the mobile
*  push stack — SidePanelLayout's tab detail ("‹ Settings") and
*  SettingsSubNav's drilled-in pane ("‹ Channels") render this one component,
*  so the bar keeps identical geometry, tint and blur across levels and the
*  back control does not visibly jump as the user pushes and pops.
*
*  Sticky to the nearest scroll container, on a blurred translucent wash of
*  the page bg (color-mix because the theme vars carry no <alpha-value> —
*  Tailwind's /opacity modifiers silently no-op) with a hairline bottom edge.
*  The chevron lands 10px from the content edge (16px inset − 6px optical
*  pull) at every level; a host whose pane already pads horizontally bleeds
*  the bar back out via `className` (e.g. `-mx-4`) so the wash stays
*  full-width.
*
*  THE BAR OWNS THE GAP BENEATH ITSELF (`mb-3`), at every level, so a host
*  never has to supply one and the two levels cannot drift apart. Without it
*  whatever follows renders ON the hairline: measured at 390px, the tab title
*  0px from the hairline to its cap height, and at the SubNav level the
*  leading element's own BORDER on the line — two lines touching, with
*  nothing to read as separation. A margin rather than padding because the bar
*  is sticky: the gap belongs to the bar's FLOW position, so content still
*  scrolls under the wash instead of stopping short of it.
*/
function NavBackBar({ label, onBack, className = "" }) {
	return /* @__PURE__ */ jsx("div", {
		className: `sticky top-0 z-10 shrink-0 mb-3 px-4 backdrop-blur-md bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] shadow-[0_1px_0_var(--border)] ${className}`,
		children: /* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: onBack,
			className: `flex items-center gap-0.5 -ml-1.5 py-2 pr-3 ${COARSE_TOUCH_TARGET} text-[14px] font-medium text-accent bg-transparent border-none cursor-pointer`,
			children: [/* @__PURE__ */ jsx(ChevronLeft, {
				size: 19,
				strokeWidth: 2.25,
				className: "shrink-0"
			}), label]
		})
	});
}
// src/host/viewport.ts
/**
* `useIsNarrowViewport`: whether the viewport is phone-width.
*
* The dashboard's hook also folds in its touch-first layout form, which is not on
* the App SDK; this reads the same width breakpoint (`max-width: 767px`).
*/
var QUERY = "(max-width: 767px)";
function media() {
	return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;
}
function subscribe(onChange) {
	const m = media();
	if (!m) return () => {};
	m.addEventListener?.("change", onChange);
	return () => m.removeEventListener?.("change", onChange);
}
function getSnapshot() {
	return media()?.matches ?? false;
}
function useIsNarrowViewport() {
	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
// src/host/usePersistedString.ts
function safeGetItem$1(key) {
	try {
		if (typeof localStorage === "undefined") return null;
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function safeSetItem$1(key, value) {
	try {
		if (typeof localStorage === "undefined") return false;
		localStorage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}
/**
* Read a persisted string without subscribing to it.
*
* Exported so a caller can seed a SECOND piece of state from the same key on the
* same first render — e.g. a form field and the "value we last submitted"
* mirror, which must agree on mount or the first request goes out with the
* default instead of the remembered value.
*/
function readPersistedString(key, defaultValue) {
	const v = safeGetItem$1(key);
	return v === null ? defaultValue : v;
}
/**
* String state persisted to localStorage — the sibling of `usePersistedBool`,
* for text preferences that should survive tab switches, navigation and reloads.
* Reads once on mount; writes (via quota-defensive `safeSetItem`) on change.
* Instances sharing a key don't live-sync; each picks the value up on its next
* mount, which is what a form field needs.
*
* Only for non-secret values. Anything credential-shaped does not belong in
* localStorage.
*/
function usePersistedString(key, defaultValue) {
	const [value, setValue] = useState(() => readPersistedString(key, defaultValue));
	useEffect(() => {
		safeSetItem$1(key, value);
	}, [key, value]);
	return [value, setValue];
}
/** Per-report cap on free-form detail, so a 1MB HTML error page can't bloat a prompt. */
var MAX_DETAIL = 1200;
/**
* Cap on the message.
*
* `friendlyErrText` returns a non-JSON body **verbatim**, so `message` can be a
* whole HTML error page rather than a sentence. Capping keeps that out of both the
* prompt and the scrubber's input.
*/
var MAX_MESSAGE = 2e3;
/**
* Blank out credential-shaped substrings.
*
* Deliberately narrow: over-redaction destroys the diagnostic value that is the
* whole point of attaching the detail. Mirrors the backend's AKIA/ASIA rule and
* adds the assignment forms (`token=…`, `"authorization": "…"`) that show up in
* echoed request bodies and config blobs.
*/
var REDACTED = "[redacted]";
var REDACTED_ACCESS_KEY = "[redacted-access-key]";
var TRUNCATION_SUFFIX = "\n[truncated]";
function redactSecrets(text) {
	return text.replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, REDACTED_ACCESS_KEY).replace(/\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, REDACTED).replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, (_m, scheme) => `${scheme}${REDACTED}@`).replace(/(^|[^\w-])([\w-]{0,32}(?:token|secret|passwd|password|api[-_]?key|session[-_]?key|authorization|credentials?)[\w-]{0,32})("?\s*[:=]\s*"?)([^\s"',;&}]{6,})/gi, (_m, before, key, sep) => `${before}${key}${sep}${REDACTED}`);
}
/**
* Scrub, THEN cap. The order is security-critical, not a style choice.
*
* Every pattern in {@link redactSecrets} needs a trailing anchor to fire: the
* userinfo rule needs its `@`, `Bearer` needs 12+ token characters, `AKIA` needs
* its full 16. Capping first can drop that anchor and leave the credential's head
* sitting in the kept prefix — `https://x-access-token:<PAT>` with the `@` on the
* discarded side no longer matches anything, and that prefix is what reaches the
* LLM prompt. Scrubbing the whole string first has no such cut to exploit.
*
* The cost of scrubbing before capping is bounded: the regex is deliberately
* linear (see the wing bound above — 2MB in ~5ms), so a multi-megabyte body is
* milliseconds, not the frozen main thread the quadratic version produced.
*/
function redactThenCap(text, max) {
	const redacted = redactSecrets(text);
	return redacted.length > max ? redacted.slice(0, max) + TRUNCATION_SUFFIX : redacted;
}
/** Trim + scrub + cap free-form detail. Returns undefined for nothing worth keeping. */
function normalizeDetail(detail) {
	if (!detail) return void 0;
	const trimmed = detail.trim();
	if (!trimmed) return void 0;
	return redactThenCap(trimmed, MAX_DETAIL);
}
/**
* Reduce a request URL to a journalable path.
*
* Query strings are dropped wholesale rather than filtered: the dashboard's own
* auth hand-off is `?token=…`, so an allowlist here would be one forgotten
* parameter away from journaling a session token into an LLM prompt.
*/
function requestPath(url) {
	if (!url) return void 0;
	try {
		return new URL(url, window.location.origin).pathname;
	} catch {
		return url.split("?")[0] || void 0;
	}
}
var _journal = [];
var _listeners = /* @__PURE__ */ new Set();
var _seq = 0;
/**
* The current route, **path only**.
*
* The query string is dropped for the same reason {@link requestPath} drops it,
* and it matters more here: the dashboard's own auth hand-off is `/?token=<…>`,
* and the token is stripped from the URL by an effect — so an API failure that
* lands before that effect runs would otherwise journal a live session token
* into a report that gets fed to an LLM. `route` is also the one field
* `recordError` does not pass through `redactSecrets`, so it has to be safe by
* construction rather than by scrubbing.
*/
function currentRoute() {
	try {
		return window.location.pathname;
	} catch {
		return "";
	}
}
/** Record an observed error. Returns the stored report (with redaction applied). */
function recordError(input) {
	const report = {
		id: `err-${Date.now().toString(36)}-${(_seq += 1).toString(36)}`,
		at: Date.now(),
		source: input.source,
		message: redactThenCap(input.message, MAX_MESSAGE),
		status: input.status,
		code: input.code,
		endpoint: input.endpoint,
		method: input.method,
		route: input.route ?? currentRoute(),
		detail: normalizeDetail(input.detail)
	};
	_journal = [report, ..._journal].slice(0, 20);
	for (const fn of _listeners) try {
		fn(_journal);
	} catch {}
	return report;
}
/**
* A transport rejection shares its message with every other network drop — the
* browser's one `Failed to fetch` / `Load failed` — so matching it by message
* is matching nothing specific. {@link isTransportRejection} marks those entries
* so the message-only lookup can refuse them (see {@link findReport}).
*/
function isTransportRejection(report) {
	return report.code === "network" || report.code === "timeout";
}
/**
* Recover the structured report behind a bare message string.
*
* The upgrade path for the ~80 existing `setError(e.message)` call sites: the
* shared banner is handed only the string it always had, and looks the context
* back up here. Exact match, newest first — an identical message from an older
* request describes the same failure well enough to prompt with.
*
* **Transport rejections are deliberately NOT findable this way.** Every network
* drop carries the same message (`Failed to fetch` in Chrome, `Load failed` in
* Safari), so a message match during an outage returns whichever endpoint
* journaled LAST — usually some background poll's, not the request the user
* acted on. Naming the wrong endpoint with confidence is worse than the bare
* message this journal replaces. Those entries are reachable ONLY through the
* report {@link attachReport} pins to the rejection, read by
* {@link reportForError}; a bare message resolves to the newest ANSWERED failure
* that matches, or to nothing.
*/
function findReport(message) {
	if (!message) return void 0;
	const needle = redactSecrets(message).trim();
	if (!needle) return void 0;
	return _journal.find((r) => !isTransportRejection(r) && r.message.trim() === needle);
}
// src/api.ts
var BASE = "/api/apps/aws-control";
/**
* Error carrying the backend's machine-readable `code` (e.g. `app_disabled`).
*
* `message` IS the code — call sites branch on it (`err.message === 'share_active'`)
* and translate it; the English prose the backend sent beside it is never
* rendered. That prose still matters to the AGENT, so it travels in `report`:
* the journal entry `request` recorded for this failure (endpoint, status, code,
* raw body). An error surface passes it to `ErrorNotice`, which is what lets
* "ask the agent" carry the real failure rather than the localised sentence the
* reader saw. Undefined only for an error built outside `request` (tests).
*/
var AwsControlError = class extends Error {
	status;
	report;
	constructor(code, status, report) {
		super(code);
		this.name = "AwsControlError";
		this.status = status;
		this.report = report;
	}
};
/**
* The journal entry behind a failed call, for an error surface that only holds
* the thrown value.
*
* An `AwsControlError` carries its own. Anything else — the `TypeError` a
* network failure rejects with — is looked up by message, which is how
* `request` journals it. Never throws: a surface that cannot recover a report
* still renders its message, and the hand-off degrades to the sentence alone.
*/
function errorReportOf(err) {
	if (err instanceof AwsControlError) return err.report;
	if (err instanceof Error) return findReport(err.message);
}
async function request(path, init) {
	const url = `${BASE}${path}`;
	let res;
	try {
		res = await fetch(url, {
			credentials: "same-origin",
			...init
		});
	} catch (e) {
		recordError({
			source: "api",
			message: e instanceof Error ? e.message : String(e),
			endpoint: requestPath(url)
		});
		throw e;
	}
	if (!res.ok) {
		let text = "";
		try {
			text = await res.text();
		} catch {}
		let code = `http_${res.status}`;
		let prose = "";
		try {
			const body = JSON.parse(text);
			if (body && typeof body.code === "string") code = body.code;
			const msg = body?.error ?? body?.detail ?? body?.message;
			if (typeof msg === "string" && msg.trim()) prose = msg;
		} catch {}
		const report = recordError({
			source: "api",
			message: prose || code,
			status: res.status,
			code,
			endpoint: requestPath(res.url) ?? requestPath(url),
			detail: text
		});
		throw new AwsControlError(code, res.status, report);
	}
	return await res.json();
}
/** POST a JSON body and read a JSON reply through the same error contract. */
function postJson(path, body) {
	return request(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body ?? {})
	});
}
var enc = encodeURIComponent;
var awsControlApi = {
	/** Aggregated account list with health + (P0: null) summaries. */
	accounts(refresh = false) {
		return request(`/accounts${refresh ? "?refresh=1" : ""}`);
	},
	/** Local AWS profile NAMES the CLI knows, each flagged whether we registered it. */
	availableProfiles() {
		return request("/profiles/available");
	},
	/** Register the named local profiles into the registry the accounts list reads. */
	registerProfiles(names) {
		return postJson("/profiles/register", { names });
	},
	/** Forget the named profiles here only; the AWS CLI configuration and every AWS resource stay as they are. */
	unregisterProfiles(names) {
		return postJson("/profiles/unregister", { names });
	},
	/** Reconnect guidance for a degraded/unknown profile, by profile name. */
	reconnectPlan(name) {
		return request(`/profiles/${enc(name)}/reconnect-plan`);
	},
	/** The exact IAM permissions to paste when a setup fails on AccessDenied. */
	iamPolicy() {
		return request("/iam-policy");
	},
	/** Drive bucket status + usage. `refresh` bypasses the 5-minute usage cache. */
	drive(account, refresh = false) {
		return request(`/drive/${enc(account)}${refresh ? "?refresh=1" : ""}`);
	},
	/** Preview the bucket that would be created (empty body → no side effect). */
	driveBootstrapPreview(account) {
		return postJson(`/drive/${enc(account)}/bootstrap`, {});
	},
	/** Create the bucket after the owner confirms the preview. */
	driveBootstrapConfirm(account) {
		return postJson(`/drive/${enc(account)}/bootstrap`, { confirm: true });
	},
	/** One page of a section's folder listing. */
	driveList(account, section, path = "", token = "") {
		const q = new URLSearchParams({ section });
		if (path) q.set("path", path);
		if (token) q.set("token", token);
		return request(`/drive/${enc(account)}/list?${q.toString()}`);
	},
	/** A short-lived presigned download URL for one file. */
	driveDownload(account, section, key) {
		const q = new URLSearchParams({
			section,
			key
		});
		return request(`/drive/${enc(account)}/download?${q.toString()}`);
	},
	/** The first bytes of a TEXT file, proxied through the gateway. A browser
	*  fetch of the presigned URL would be blocked by CORS (the bucket carries
	*  no CORS config), so text preview reads through this endpoint instead;
	*  media previews (img/video/iframe) use the presigned URL directly because
	*  those tags are exempt from CORS. */
	drivePreview(account, section, key) {
		const q = new URLSearchParams({
			section,
			key
		});
		return request(`/drive/${enc(account)}/preview?${q.toString()}`);
	},
	/** Case-insensitive filename search across one whole section. */
	driveSearch(account, section, query) {
		const q = new URLSearchParams({
			section,
			q: query
		});
		return request(`/drive/${enc(account)}/search?${q.toString()}`);
	},
	/** Move one stored object inside the files section (server-side copy, then
	*  delete — the delete only happens after the copy succeeded; the backend
	*  refuses to overwrite an existing destination with a 409). */
	driveMove(account, section, fromKey, toKey) {
		return postJson(`/drive/${enc(account)}/move`, {
			section,
			fromKey,
			toKey
		});
	},
	/** Upload a file's raw bytes to `key` within a section. */
	driveUpload(account, section, key, body) {
		const q = new URLSearchParams({
			section,
			key
		});
		return request(`/drive/${enc(account)}/upload?${q.toString()}`, {
			method: "POST",
			body
		});
	},
	/** Delete one object from a section. */
	driveDelete(account, section, key) {
		return postJson(`/drive/${enc(account)}/delete`, {
			section,
			key
		});
	},
	/**
	* Create a folder.
	*
	* S3 has no directories: an EMPTY folder exists only as a zero-byte object
	* whose key ends in '/', which is what the backend writes. The listing filters
	* that placeholder out of its files, so the folder surfaces through
	* CommonPrefixes like any prefix that happens to hold objects. Idempotent -
	* creating an existing folder is a no-op put.
	*/
	driveFolderCreate(account, section, path) {
		return postJson(`/drive/${enc(account)}/folder`, {
			section,
			path
		});
	},
	/**
	* Delete a folder and everything under it.
	*
	* The backend anchors on the section prefix plus a trailing slash (so a
	* sibling `photos-backup/` is not swept up with `photos/`) and pages the batch
	* delete, and it refuses an empty or slash-only path through the same key
	* validator every object key goes through - a folder delete cannot widen into
	* a section- or bucket-wide wipe. `objects` is how many were removed.
	*/
	driveFolderDelete(account, section, path) {
		return postJson(`/drive/${enc(account)}/folder/delete`, {
			section,
			path
		});
	},
	/** Mint a time-boxed share link. The returned URL is shown once, never stored. */
	driveShare(account, section, key, expiresSecs, note) {
		return postJson(`/drive/${enc(account)}/share`, {
			section,
			key,
			expiresSecs,
			note
		});
	},
	/** Active share links for an account. */
	shares(account) {
		return request(`/shares?account=${enc(account)}`);
	},
	/** Forget one share link (removes the record; the link still expires on its own). */
	shareForget(id) {
		return postJson(`/shares/${enc(id)}/forget`, {});
	},
	/** Month-to-date + projected spend. `refresh` bypasses the cache. */
	costs(account, refresh = false) {
		return request(`/costs/${enc(account)}${refresh ? "?refresh=1" : ""}`);
	},
	/** The account's cloud artifact library, with per-artifact sync state. */
	library(account) {
		return request(`/library/${enc(account)}`);
	},
	/** Push one artifact's current version to the bucket. */
	libraryPush(account, slug) {
		return postJson(`/library/${enc(account)}/push`, { slug });
	},
	/** Remove one artifact's cloud copy (objects + ledger entry). */
	libraryRemove(account, slug) {
		return postJson(`/library/${enc(account)}/remove`, { slug });
	},
	/** Backup status: last local runs, remote archive, nightly toggle. */
	/**
	* Backup status for one account.
	*
	* `remote` defaults to OFF because this endpoint is polled while a run is in
	* flight: its remote half tag-discovers the bucket and lists the archive on
	* every call, so polling it would spend paid AWS round trips to read a fact the
	* server holds in memory. Ask for it only when the stored-archive list is open.
	*/
	backup(account, opts) {
		const q = new URLSearchParams();
		if (opts?.remote) q.set("remote", "1");
		if (opts?.others) q.set("others", "1");
		const qs = q.toString();
		return request(`/backup/${enc(account)}${qs ? `?${qs}` : ""}`);
	},
	/**
	* Start a backup. Returns as soon as the run is claimed, NOT when it finishes:
	* the work is a durable host-owned job, so follow it with the account-scoped
	* `jobs` block on `GET /backup/{account}` rather
	* than by awaiting this call.
	*/
	backupRun(account, kind) {
		return postJson(`/backup/${enc(account)}/run`, { kind });
	},
	/** Enable/disable the nightly snapshot. */
	backupNightly(account, enabled) {
		return postJson(`/backup/${enc(account)}/nightly`, { enabled });
	},
	/**
	* Enable/disable the nightly SESSIONS archive -- a separate grant.
	*
	* Its own endpoint rather than a second field on the snapshot call, so one
	* request can never carry both grants: saying yes to uploading transcripts is
	* meant to be its own act.
	*/
	backupNightlySessions(account, enabled) {
		return postJson(`/backup/${enc(account)}/nightly-sessions`, { enabled });
	},
	/**
	* Restore one archived key into a local staging folder (nothing is hot-swapped).
	*
	* `foreignOk` overrides the backend's refusal to restore any archive it cannot
	* prove is this install's own (409 `foreign_install_archive`); it is sent only
	* after the reader confirms in-page. That covers every non-self origin, legacy
	* included -- a pre-namespace archive carries no id, so it confirms and then
	* sends the override like any other unproven row. The decision is on the
	* archive's owning id, never its human label.
	*/
	backupRestore(account, key, foreignOk) {
		const body = foreignOk ? {
			key,
			foreignOk: true
		} : { key };
		return postJson(`/backup/${enc(account)}/restore`, body);
	},
	/** Rename this install, so its archives render as a name on a co-tenant drive. */
	installLabel(label) {
		return postJson("/install/label", { label });
	}
};
// src/host/clipboard.ts
/**
* Copy text to the clipboard. The dashboard's helper adds a non-secure-context
* fallback through a hidden textarea; this keeps the same contract (resolves
* `true` when the text was copied, never rejects).
*/
async function copyToClipboard(text) {
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand?.("copy") ?? false;
		document.body.removeChild(area);
		return ok;
	} catch {
		return false;
	}
}
/** Copy a command or code snippet; the same call, named for its call sites. */
function copyCode(text) {
	return copyToClipboard(text);
}
// src/shared.tsx
/**
* Pieces both AWS Control surfaces render: the per-account console and the cloud
* drive page.
*
* They live here rather than in either surface because importing across the two
* would be circular - the console navigates INTO the drive page, so the drive
* page cannot import from the console.
*/
/**
* Every error this app shows renders through here, and through nothing else.
*
* The shared `ErrorNotice` recovers an error's context (endpoint, status, the
* backend's `code`, the raw body) from the error journal by MESSAGE — which
* works for the rest of the dashboard because those surfaces render
* `e.message`. This app renders a localised sentence instead, so the lookup can
* never match. `error` is the thrown value, and `errorReportOf` reads the journal
* entry the client attached to it — that is the whole reason this wrapper
* exists. A surface with no thrown value (a reason the backend reported inside
* a 200) omits it, and the hand-off carries the sentence.
*
* The agent hand-off keeps `ErrorNotice`'s own opt-in default and is stated at
* every call site. The sites that leave it off are the two notices beside a
* live input (the folder-name field, the share note, the ticked profiles of
* the Add-accounts form), where the navigation would take the typed text
* with the page, and the client-side name checks,
* which never reached AWS and have nothing for the agent to read. Everywhere
* else an AWS failure (AccessDenied on a bucket, an expired SSO session, a
* region mismatch) is exactly the kind the agent can diagnose from the report
* and the reader cannot from the sentence, and there is nothing on screen to
* lose — so every other notice opts in. Two panes go one step further because
* all of their notices share the screen with one draft: the Files pane gates
* on the folder-name disclosure being closed (`handOff` in `useDrivePageFiles`),
* and the accounts pane gates on no profile being ticked in the Add-accounts
* form (`handOff` in `AccountsPane`, fed by `AddAccounts`'s `onDraftChange`).
*/
function AwsErrorNotice({ error, message, title, variant = "block", className, testId, onRetry, askAgent, askAgentLabel, actionPlacement }) {
	const notice = /* @__PURE__ */ jsx(ui_default$1, {
		message,
		report: errorReportOf(error),
		title,
		variant,
		askAgent,
		askAgentLabel,
		actionPlacement,
		className: onRetry ? "w-full" : className,
		testId
	});
	if (!onRetry || !message) return notice;
	return /* @__PURE__ */ jsxs("div", {
		className: `flex flex-col items-start gap-2 ${className ?? ""}`,
		children: [notice, /* @__PURE__ */ jsxs(Btn, {
			onClick: onRetry,
			"data-testid": testId ? `${testId}-retry` : void 0,
			children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("apps.awsControl.console.retry")]
		})]
	});
}
/** Copy-to-clipboard button that flips to a check for ~1.5s. */
function CopyBtn({ text, testId, ariaLabel }) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		if (await copyToClipboard(text)) {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		}
	};
	return /* @__PURE__ */ jsxs(Btn, {
		onClick: copy,
		"data-testid": testId,
		"aria-label": ariaLabel,
		children: [copied ? /* @__PURE__ */ jsx(Check, {
			size: 13,
			className: "text-ok"
		}) : /* @__PURE__ */ jsx(Copy, { size: 13 }), copied ? i18nT("apps.awsControl.console.copied") : i18nT("apps.awsControl.console.copy")]
	});
}
/**
* Title row for one rail pane: an accent icon, the pane's name at the SAME
* title metrics as `PageHeader` (`text-2xl font-bold tracking-tight`), and the
* pane's own actions on the right. The rail already answers "where am I", so
* there is no back-crumb — a pane is a sibling, not a descent. Actions wrap
* under the title on narrow viewports rather than clipping.
*
* `subtitle` is the pane's one-line orientation, and it belongs HERE rather
* than as a floating `<p>` under the header: a paragraph the panes each placed
* themselves drifted in gutter, size and gap from one pane to the next, and it
* is the same defect the shared title metrics already fixed one line above it.
* It takes a node, not just a string, so a caller can keep a test id or a
* mono fragment on the sentence it owns while the type scale stays here.
*/
function PaneHeader({ icon, title, meta, subtitle, actions }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mb-4",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-x-3 gap-y-2",
			children: [
				icon && /* @__PURE__ */ jsx("span", {
					className: "shrink-0 text-accent",
					children: icon
				}),
				/* @__PURE__ */ jsx("span", {
					className: "min-w-0 max-w-full truncate text-2xl font-bold tracking-tight text-text-strong",
					"data-testid": "page-title",
					children: title
				}),
				meta,
				/* @__PURE__ */ jsx("span", { className: "flex-1" }),
				actions
			]
		}), subtitle && /* @__PURE__ */ jsx("p", {
			className: "mt-1 max-w-[80ch] text-[13px] leading-relaxed text-muted",
			"data-testid": "pane-subtitle",
			children: subtitle
		})]
	});
}
/**
* `StatCard` plus ONE line of context under its value, opening the pane that
* owns the figure.
*
* The sub-line is what turns a number into a reading — "2" says little beside
* "1 needs attention" — and `StatCard` has no slot for it: `value` is typed
* `string | number` and the component renders no children. So this COMPOSES the
* shared card rather than forking a lookalike beside it, and lays the line over
* the bottom inset the card is asked to reserve (`pb-9`). One surface, one
* border, one entrance animation.
*
* `onClick` is required rather than optional because every figure this app
* restates has a pane that owns it, and the card is the way through. It is also
* what gives the card its hover lift: `StatCard` paints one only when clickable.
*
* `pointer-events-none` is what keeps the card's own hover working underneath
* the line, and `group-hover` mirrors the card's lift so the two cannot drift
* apart mid-transition. `tabular-nums` sits on the card because
* `font-variant-numeric` inherits, and the value it decorates is inside.
*/
function MetricCard({ label, value, sub, accent, delay, testId, onClick }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "group relative",
		children: [/* @__PURE__ */ jsx(StatCard, {
			label,
			value,
			accent,
			delay,
			onClick,
			className: "h-full pb-9 tabular-nums",
			"data-testid": testId
		}), sub && /* @__PURE__ */ jsx("span", {
			className: "pointer-events-none absolute inset-x-4 bottom-3 truncate text-[12px] text-muted",
			"data-testid": testId ? `${testId}-sub` : void 0,
			children: sub
		})]
	});
}
var STORAGE_SECTIONS = [
	"drive",
	"library",
	"backup"
];
/**
* Section → fill token. Three distinguishable hues from the theme, no hex.
* `info`, not `aim`, for the library: in the shipped purple themes aim sits on
* accent, and the two largest segments became one purple with a seam.
*/
var STORAGE_TONE = {
	drive: "bg-accent",
	library: "bg-info",
	backup: "bg-muted/45"
};
var STORAGE_LABEL = {
	drive: "apps.awsControl.console.section_files",
	library: "apps.awsControl.console.section_library",
	backup: "apps.awsControl.console.section_backup"
};
/**
* The drive's bytes split three ways: a single 6px track with one segment per
* section, and a legend that names every section including the 0-byte ones.
*
* An empty drive draws the bare track rather than nothing, so the card never
* reads as "failed to load". Colour is never the only cue — the legend spells
* out each section with its own size beside its swatch.
*/
function StorageBar({ usage, testId = "storage-bar" }) {
	const total = usage.bytes;
	return /* @__PURE__ */ jsxs("div", {
		"data-testid": testId,
		children: [/* @__PURE__ */ jsx("div", {
			className: "flex h-1.5 w-full overflow-hidden rounded-full bg-bg-hover",
			"data-testid": `${testId}-bar`,
			role: "img",
			"aria-label": i18nT("apps.awsControl.overview.drive_bar_label", { size: fmtBytes(total) }),
			children: total > 0 && STORAGE_SECTIONS.map((s) => {
				const pct = usage.sections[s].bytes / total * 100;
				if (pct <= 0) return null;
				return /* @__PURE__ */ jsx("span", {
					className: `h-full ${STORAGE_TONE[s]}`,
					style: { width: `${pct}%` },
					"data-testid": `${testId}-segment-${s}`
				}, s);
			})
		}), /* @__PURE__ */ jsx("div", {
			className: "mt-2 flex flex-wrap gap-x-4 gap-y-1",
			"data-testid": `${testId}-legend`,
			children: STORAGE_SECTIONS.map((s) => /* @__PURE__ */ jsxs("span", {
				className: "flex items-center gap-1.5 text-[12px]",
				"data-testid": `${testId}-legend-${s}`,
				children: [
					/* @__PURE__ */ jsx("span", {
						className: `h-2 w-2 shrink-0 rounded-full ${STORAGE_TONE[s]}`,
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "text-muted",
						children: i18nT(STORAGE_LABEL[s])
					}),
					/* @__PURE__ */ jsx("span", {
						className: "font-mono tabular-nums text-text",
						children: fmtBytes(usage.sections[s].bytes)
					})
				]
			}, s))
		})]
	});
}
/**
* One small tile inside a card: an icon, a name, and one counted line under it.
*
* Two shapes from one prop. With `onClick` the tile is a bordered, hover-lit
* target that opens what it names, on `Clickable` so role, tab order and
* Enter/Space come from the primitive. Without it the same three facts render
* as a flat row with no border — a bordered box that does nothing reads as a
* button, and readers clicked the read-only ones expecting to land somewhere.
*
* The bordered shape is `bg-bg-elevated` rather than `bg-card` because it sits
* INSIDE a card, and repeating the card fill would make the two surfaces
* indistinguishable.
*/
function QuickTile({ icon, label, count, testId, onClick }) {
	const body = /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
		className: "mt-0.5 shrink-0 text-muted",
		children: icon
	}), /* @__PURE__ */ jsxs("span", {
		className: "min-w-0",
		children: [/* @__PURE__ */ jsx("span", {
			className: "block text-[13px] font-medium leading-snug text-text-strong",
			children: label
		}), /* @__PURE__ */ jsx("span", {
			className: "block truncate font-mono text-[12px] tabular-nums text-muted",
			"data-testid": testId ? `${testId}-count` : void 0,
			children: count
		})]
	})] });
	return onClick ? /* @__PURE__ */ jsx(ui_default$2, {
		onClick,
		"aria-label": label,
		className: "flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-border bg-bg-elevated p-3 text-left transition-colors hover:border-border-strong hover:bg-bg-hover focus-ring",
		"data-testid": testId,
		children: body
	}) : /* @__PURE__ */ jsx("div", {
		className: "flex min-w-0 items-start gap-2 py-1.5",
		"data-testid": testId,
		children: body
	});
}
// src/host/Trans.tsx
/**
* `<Trans>` for the one string the page renders with markup inside it.
*
* react-i18next is the dashboard's, not the App SDK's. This reads the same catalog
* string through `t`, then replaces each `<name>…</name>` tag with the matching
* element from `components` (its children become the tag's inner text). Text
* outside a known tag is rendered as text, never as HTML.
*/
var TAG = /<(\w+)>(.*?)<\/\1>|<(\w+)\s*\/>/g;
function Trans({ i18nKey, values, components = {} }) {
	const text = t(i18nKey, values);
	const parts = [];
	let last = 0;
	let index = 0;
	for (const match of text.matchAll(TAG)) {
		const at = match.index ?? 0;
		if (at > last) parts.push(text.slice(last, at));
		const name = match[1] ?? match[3];
		const inner = match[2] ?? "";
		const element = components[name];
		parts.push(element ? cloneElement(element, { key: `t${index++}` }, inner || element.props.children) : inner);
		last = at + match[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return /* @__PURE__ */ jsx(Fragment, { children: parts });
}
// src/host/useDialogFocusTrap.ts
/**
* The dashboard's own trap shares the IME composition latch (`useDocumentImeLatch`),
* which is not on the App SDK. A native key event carries `isComposing` while an IME
* owns it, so this stand-in declines exactly those keys: a Tab or Escape that picks
* or cancels a candidate is left to the IME. It does not cover WebKit's post-commit
* keydown that arrives with `isComposing` already false (PORTING.md, "Dialog keys").
*/
var imeKeyLatch = { claimKey(e) {
	if (e.isComposing || e.keyCode === 229) {
		e.stopPropagation();
		return false;
	}
	return true;
} };
/** Focusable descendants of a dialog, in DOM order, skipping disabled ones. */
var FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex=\"-1\"])";
/**
* Mount order of every trap whose Tab handling is armed. Only the newest
* MOUNTED one moves focus on Tab.
*
* `enabled` covers a dialog that knows it opened an inner one. This covers the
* one that does not: the image viewer opens from a document-level event, over
* whichever Modal holds the markdown. Two armed traps would each pull focus
* back inside themselves on every Tab, so focus could never leave the newer
* dialog's first control. The order is the mount order, not the arm order, so
* an outer dialog re-arming on a re-render does not jump back in front.
* Escape is not gated here: its owners already consume it in order (see
* `handleEscape`).
*/
var nextTrapOrder = 0;
var armedTabTraps = /* @__PURE__ */ new Set();
var newestArmedTrap = () => Math.max(-1, ...armedTabTraps);
function useDialogFocusTrap(containerRef, onEscape, { enabled = true, handleEscape = true, restoreFocus = true } = {}) {
	useEffect(() => {
		const restoreTo = restoreFocus ? document.activeElement : null;
		(Array.from(containerRef.current?.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex=\"-1\"])") ?? []).find((el) => el.tabIndex >= 0) ?? containerRef.current)?.focus({ preventScroll: true });
		return () => restoreTo?.focus?.({ preventScroll: true });
	}, [containerRef, restoreFocus]);
	const imeLatch = imeKeyLatch;
	const crewHidden = false;
	const mountOrderRef = useRef(0);
	useLayoutEffect(() => {
		mountOrderRef.current = ++nextTrapOrder;
	}, []);
	useLayoutEffect(() => {
		if (!enabled || crewHidden) return;
		const order = mountOrderRef.current;
		armedTabTraps.add(order);
		const onKey = (e) => {
			if (e.key === "Escape" && handleEscape) {
				if (!imeLatch.claimKey(e)) return;
				onEscape();
				return;
			}
			const container = containerRef.current;
			if (e.key !== "Tab" || !container) return;
			if (newestArmedTrap() !== order) return;
			const items = Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
			if (!items.length) return;
			const firstEl = items[0];
			const lastEl = items[items.length - 1];
			const active = document.activeElement;
			const wrapsForward = !e.shiftKey && active === lastEl;
			const wrapsBackward = e.shiftKey && (active === firstEl || active === container);
			const refocuses = !wrapsForward && !wrapsBackward && !container.contains(active);
			if (!wrapsForward && !wrapsBackward && !refocuses) return;
			if (!imeLatch.claimKey(e)) return;
			e.preventDefault();
			(wrapsBackward ? lastEl : firstEl).focus();
		};
		window.addEventListener("keydown", onKey, true);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			armedTabTraps.delete(order);
		};
	}, [
		containerRef,
		onEscape,
		enabled,
		handleEscape,
		imeLatch,
		crewHidden
	]);
}
// src/DrivePageControls.tsx
/**
* AWS Control drive - the controls more than one pane of the drive page draws.
*
* The `</>` CLI drawer under a listing, the grid/list toggle together with the
* per-section choice it persists (`useViewMode`), and the inline confirm strip a
* grid tile or a list row opens for a destructive action (`TileConfirm`). The
* Library and Files panes both render these, so each is defined once, here.
* `DrivePage.tsx` re-exports `TileConfirm` for `AwsControlPage.tsx`, which also
* renders it, as an account row's remove-account confirm.
*/
/** A collapsible `</>` drawer: the bucket, a prefix, and a generic CLI line. */
function CliDrawer({ bucket, prefix }) {
	const [open, setOpen] = useState(false);
	const line = `aws s3 ls s3://${bucket}/${prefix}`;
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-2",
		"data-testid": "cli-drawer",
		children: [/* @__PURE__ */ jsxs("button", {
			onClick: () => setOpen((v) => !v),
			className: "inline-flex items-center gap-1 text-[12px] text-muted hover:text-text cursor-pointer bg-transparent border-none p-0",
			"aria-expanded": open,
			"data-testid": "cli-drawer-toggle",
			children: [
				/* @__PURE__ */ jsx(Code, { size: 12 }),
				i18nT("apps.awsControl.console.cli_drawer_label"),
				/* @__PURE__ */ jsx(ChevronDown, {
					size: 12,
					className: `transition-transform ${open ? "rotate-180" : ""}`
				})
			]
		}), open && /* @__PURE__ */ jsxs("div", {
			className: "mt-1.5 rounded-md border border-border bg-bg-elevated p-2.5 text-[12px]",
			"data-testid": "cli-drawer-body",
			children: [/* @__PURE__ */ jsx("div", {
				className: "text-muted mb-1",
				children: i18nT("apps.awsControl.console.cli_drawer_hint", {
					bucket,
					prefix
				})
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ jsx("code", {
					className: "flex-1 min-w-0 break-all rounded bg-bg px-2 py-1.5 font-mono text-[12px] text-text",
					children: line
				}), /* @__PURE__ */ jsx(CopyBtn, { text: line })]
			})]
		})]
	});
}
var VIEW_MODE_STORAGE_KEY = {
	drive: "awsControl.drive.viewMode.drive",
	library: "awsControl.drive.viewMode.library"
};
function useViewMode(section, fallback) {
	const [raw, setRaw] = usePersistedString(VIEW_MODE_STORAGE_KEY[section], fallback);
	return [raw === "list" ? "list" : raw === "grid" ? "grid" : fallback, (v) => setRaw(v)];
}
/**
* The grid/list pair.
*
* This is `SegmentedControl`, not a hand-rolled pair of buttons: the Artifacts
* gallery already drives the IDENTICAL grid-vs-table choice through it, and a
* second spelling of one control is how the two drift apart. `collapse={false}`
* because this sits in a content-hugging header group rather than a measured
* column, which is the same reason the gallery passes it. Each section owns its
* own `layoutId` -- the indicator is a framer shared-layout animation, and two
* live controls sharing one id fight over it.
*
* `iconOnly`, where the gallery shows labels: this toggle shares a pane header
* with two more actions (New folder, Upload) that the gallery's toolbar does
* not carry, and the header sits in a pane the rail has already narrowed. Two
* labelled segments plus two labelled buttons wrap to a second toolbar row at
* ordinary desktop widths; the glyphs are the same ones the gallery draws, so
* the control is recognised from there rather than re-learned.
*/
function ViewModeToggle({ section, mode, onChange }) {
	return /* @__PURE__ */ jsx(ui_default, {
		segments: [{
			key: "grid",
			label: i18nT("apps.awsControl.console.view_grid"),
			icon: /* @__PURE__ */ jsx(LayoutGrid, { size: 13 })
		}, {
			key: "list",
			label: i18nT("apps.awsControl.console.view_list"),
			icon: /* @__PURE__ */ jsx(List, { size: 13 })
		}],
		value: mode,
		onChange,
		layoutId: `aws-drive-view-${section}`,
		collapse: false,
		iconOnly: true
	});
}
/**
* The confirm for one grid tile, rendered by that tile.
*
* Not one strip above the grid: that names a single item while sitting next to
* every other one -- the same trap the table rows avoid by making the confirm
* their own next row -- and in a scrolled folder it paints off-screen, so the
* menu click reads as a no-op while a live destructive control sits parked out
* of sight.
*/
function TileConfirm({ label, error, errorSource, askAgent, pending, onCancel, onConfirm, action, testId = "drive-grid-confirm" }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-1 w-full border-t border-border pt-2",
		"data-testid": testId,
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "mb-2 text-[12px] leading-snug text-text",
				children: label
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent,
				error: errorSource,
				message: error,
				variant: "inline",
				className: "mb-2",
				testId: `${testId}-error`
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ jsx(Btn, {
					onClick: onCancel,
					disabled: pending,
					"data-testid": `${testId}-cancel`,
					children: i18nT("apps.awsControl.console.cancel")
				}), /* @__PURE__ */ jsxs(Btn, {
					danger: true,
					disabled: pending,
					onClick: onConfirm,
					"data-testid": `${testId}-action`,
					children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), action]
				})]
			})
		]
	});
}
// src/host/RadioChipGroup.tsx
/**
* One-of-N choice drawn as a row of buttons (chips, swatches, mode buttons),
* announced and operated as a radio group (WAI-ARIA radio pattern).
*
* Why not `aria-pressed`: `aria-pressed` reads as N independent on/off toggles,
* so a screen-reader user hears "pressed" / "not pressed" per button and is
* never told the buttons are one single-select set (#27459). A genuine two-state
* toggle (one button that is on or off, or a pair where pressing the active one
* clears it) keeps `aria-pressed` and does not use this group.
*
* How to use: wrap the options in `<RadioChipGroup>` with a name
* (`ariaLabel` or `ariaLabelledBy`), and give each option `{...radioChip(checked)}`
* instead of `aria-pressed`. Options must be focusable elements (`<button>`).
*
* The group owns the keyboard behaviour so no call site re-implements it:
* - One Tab stop. While focus is inside the group it is the focused option;
*   otherwise it is the checked option, or the first enabled one when none is
*   checked. The group sets each option's `tabIndex` itself, so options must
*   NOT pass their own `tabIndex` prop.
* - Arrow keys (Right/Down next, Left/Up previous, wrapping) and Home/End move
*   focus; disabled options are skipped. By default they do NOT select: many
*   consumers save on every change (settings write config, a palette saves and
*   closes, the guide's pick list commits and unmounts), so passing over an
*   option must never persist it. Space/Enter (the native button click)
*   chooses. This is the rule `SegmentedControl` already follows.
* - `selectOnArrow` opts a group into "arrow moves AND selects" (the native
*   radio behaviour), for a group where a pick is cheap and reversible and
*   that behaviour is already established (the sidebar duration chips, #22330).
* - The key is consumed (`stopPropagation`) so a host Radix menu does not also
*   treat it as its own item-to-item navigation and pull focus out.
*/
function RadioChipGroup({ ariaLabel, ariaLabelledBy, className, style, children, onKeyDown: ownKeyDown, selectOnArrow = false, "data-testid": testId }) {
	const ref = useRef(null);
	useLayoutEffect(() => {
		if (ref.current) placeTabStop(ref.current);
	});
	const onKeyDown = (e) => {
		ownKeyDown?.(e);
		if (e.defaultPrevented) return;
		if (!(e.key === "Home" || e.key === "End") && RADIO_KEY_STEP[e.key] === void 0) return;
		const radios = ownRadios(e.currentTarget).filter((r) => !isDisabled(r));
		if (radios.length === 0) return;
		e.preventDefault();
		e.stopPropagation();
		const current = radios.indexOf(document.activeElement);
		const next = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (Math.max(current, 0) + RADIO_KEY_STEP[e.key] + radios.length) % radios.length;
		radios[next].focus();
		if (selectOnArrow) radios[next].click();
	};
	return /* @__PURE__ */ jsx("div", {
		ref,
		role: "radiogroup",
		"aria-label": ariaLabel,
		"aria-labelledby": ariaLabelledBy,
		className,
		style,
		onKeyDown,
		"data-testid": testId,
		onFocus: (e) => placeTabStop(e.currentTarget),
		onBlur: (e) => {
			const group = e.currentTarget;
			if (!group.contains(e.relatedTarget)) placeTabStop(group, true);
		},
		children
	});
}
/** The attributes an option inside a `RadioChipGroup` carries in place of
*  `aria-pressed`. */
function radioChip(checked) {
	return {
		role: "radio",
		"aria-checked": checked
	};
}
/** Arrow-key step through a radio group (WAI-ARIA radio pattern: Right/Down is
*  the next radio, Left/Up the previous, wrapping at either end). */
var RADIO_KEY_STEP = {
	ArrowRight: 1,
	ArrowDown: 1,
	ArrowLeft: -1,
	ArrowUp: -1
};
/** Give exactly one of the group's own enabled radios `tabIndex` 0: the
*  focused one while focus is inside (unless `leaving`), else the checked one,
*  else the first. */
function placeTabStop(group, leaving = false) {
	const radios = ownRadios(group);
	const enabled = radios.filter((r) => !isDisabled(r));
	const stop = (leaving ? void 0 : enabled.find((r) => r === document.activeElement)) ?? enabled.find((r) => r.getAttribute("aria-checked") === "true") ?? enabled[0];
	for (const r of radios) r.tabIndex = r === stop ? 0 : -1;
}
/** This group's own radios, not those of a radio group nested inside it. */
function ownRadios(group) {
	return Array.from(group.querySelectorAll("[role=\"radio\"]")).filter((r) => r.closest("[role=\"radiogroup\"]") === group);
}
function isDisabled(el) {
	return el.disabled === true || el.getAttribute("aria-disabled") === "true";
}
// src/DrivePageLibrary.tsx
/**
* AWS Control drive - the Library pane: what is in the bucket's `artifacts/`
* prefix, and the picker that copies a local artifact into it.
*
* `LibrarySection` lists the prefix (one card or row per cloud folder), joins it
* to the local library only for a name, kind and preview, and owns removal.
* `AddFromArtifactsDialog` lists the LOCAL artifacts and pushes each one with its
* own request. Both hold per-card state as set membership (`withSlug`,
* `withFailure`).
* `DrivePage.tsx` re-exports `LibrarySection`.
*/
var KIND_LABEL_KEY = {
	widget: "apps.awsControl.console.kind_widget",
	markdown: "apps.awsControl.console.kind_markdown",
	html: "apps.awsControl.console.kind_html",
	svg: "apps.awsControl.console.kind_svg",
	json: "apps.awsControl.console.kind_json",
	text: "apps.awsControl.console.kind_text",
	webapp: "apps.awsControl.console.kind_webapp",
	image: "apps.awsControl.console.kind_image"
};
var KIND_KEYS = [
	"widget",
	"markdown",
	"html",
	"svg",
	"json",
	"text",
	"webapp",
	"image"
];
/**
* One artifact's preview: its kind's glyph and label.
*
* The built-in drew the Artifacts gallery's own thumbnails here (a sandboxed widget
* frame, a web-app preview, an image, a markdown excerpt), fetching each artifact's
* full body from the dashboard's artifact API. Neither the thumbnails nor that API
* are open to an installed app (PORTING.md, "Library previews"), so the card shows
* what the listing already carries. The box keeps the height a thumb settled at, so
* the grid reads the same.
*/
var KIND_ICON = {
	widget: LayoutDashboard,
	markdown: FileText,
	html: Code,
	svg: Shapes,
	json: Braces,
	text: FileText,
	webapp: AppWindow,
	image: Image
};
function ArtifactPreview({ kind }) {
	const Icon = KIND_ICON[kind] ?? FileText;
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-[120px] flex-col items-center justify-center gap-1.5 bg-bg-elevated p-3 text-center",
		"data-testid": "library-kind-thumb",
		children: [/* @__PURE__ */ jsx(Icon, {
			size: 22,
			className: "text-muted",
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsx("span", {
			className: "text-[11px] leading-tight text-muted",
			children: i18nT(KIND_LABEL_KEY[kind])
		})]
	});
}
/**
* A stored object with no local artifact behind it.
*
* The cloud copy outlives the local one — an artifact deleted locally, or a drive
* pushed to from another machine, both land here. There is nothing to preview
* (the bytes are in S3 and previewing them would cost a presign plus a fetch per
* card), so the card says so plainly instead of showing a broken frame.
*/
function OrphanThumb() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-[120px] flex-col items-center justify-center gap-1.5 bg-bg-elevated p-3 text-center",
		children: [/* @__PURE__ */ jsx(CloudOff, {
			size: 18,
			className: "text-muted",
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsx("span", {
			className: "text-[11px] leading-tight text-muted",
			children: i18nT("apps.awsControl.console.library_cloud_only")
		})]
	});
}
var withSlug = (set, slug) => new Set(set).add(slug);
var withoutSlug = (set, slug) => {
	const next = new Set(set);
	next.delete(slug);
	return next;
};
var withFailure = (map, slug, err) => new Map(map).set(slug, err ?? null);
var withoutFailure = (map, slug) => {
	const next = new Map(map);
	next.delete(slug);
	return next;
};
/**
* The Library folder — what is ACTUALLY in the bucket's `artifacts/` prefix.
*
* This section used to render `GET /library/{account}`, which lists every LOCAL
* artifact with its push state. That made a folder inside the drive show 212
* things that were not in the drive, all of them labelled "not synced", while the
* Files folder next to it sat empty — so the two folders could not be told apart
* by looking at them, which is exactly what a reader asked about. It now lists
* the prefix, so an object is here if and only if it is in the cloud, and the
* local library is reached through the "add from Artifacts" picker instead.
*
* A push writes `library/{slug}/v{version}{ext}` plus `library/{slug}/meta.json`,
* so the prefix's top level is one FOLDER per slug. Each folder name IS the slug,
* which is what lets a card recover the artifact's name, kind and preview from
* the local library; an object with no local copy falls back to `OrphanThumb`.
*/
function LibrarySection({ account, bucket }) {
	const [mode, setMode] = useViewMode("library", "grid");
	const [picking, setPicking] = useState(false);
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const openerRef = useRef(null);
	const addBtnRef = useRef(null);
	const openPicker = () => {
		openerRef.current = document.activeElement;
		setPicking(true);
	};
	const closePicker = () => {
		const opener = openerRef.current;
		setPicking(false);
		requestAnimationFrame(() => {
			(opener?.isConnected ? opener : addBtnRef.current)?.focus?.({ preventScroll: true });
		});
	};
	const [confirmSlug, setConfirmSlug] = useState(null);
	const [pendingSlugs, setPendingSlugs] = useState(/* @__PURE__ */ new Set());
	const [failedSlugs, setFailedSlugs] = useState(/* @__PURE__ */ new Map());
	const removeMut = useMutation({
		mutationFn: (slug) => awsControlApi.libraryRemove(account, slug),
		onMutate: (slug) => {
			setPendingSlugs((prev) => withSlug(prev, slug));
			setFailedSlugs((prev) => withoutFailure(prev, slug));
		},
		onSuccess: (_data, slug) => {
			setConfirmSlug((cur) => cur === slug ? null : cur);
			qc.invalidateQueries({ queryKey: appKey(["drive", account]) });
			qc.invalidateQueries({ queryKey: appKey(["library", account]) });
		},
		onError: (err, slug) => setFailedSlugs((prev) => withFailure(prev, slug, err)),
		onSettled: (_data, _err, slug) => setPendingSlugs((prev) => withoutSlug(prev, slug))
	});
	const askRemove = (slug) => setConfirmSlug(slug);
	/** The strip's props for one slug, so grid and list cannot drift apart. */
	const confirmFor = (slug, title) => ({
		label: /* @__PURE__ */ jsxs(Fragment$1, { children: [
			i18nT("apps.awsControl.console.library_remove_confirm", { name: title }),
			" ",
			/* @__PURE__ */ jsx("span", {
				className: "text-text",
				children: /* @__PURE__ */ jsx(Trans, {
					i18nKey: "apps.awsControl.console.library_remove_confirm_slug",
					values: { folder: `artifacts/${slug}/` },
					components: { folder: /* @__PURE__ */ jsx("code", { className: "text-[11px] text-text" }) }
				})
			})
		] }),
		error: "",
		askAgent: true,
		pending: pendingSlugs.has(slug),
		onCancel: () => {
			setConfirmSlug(null);
			setFailedSlugs((prev) => withoutFailure(prev, slug));
		},
		onConfirm: () => removeMut.mutate(slug),
		action: pendingSlugs.has(slug) ? i18nT("apps.awsControl.console.library_removing") : i18nT("apps.awsControl.console.library_remove_action"),
		testId: "library-remove-confirm"
	});
	const listQ = useInfiniteQuery({
		queryKey: appKey([
			"drive",
			account,
			"list",
			"library"
		]),
		queryFn: ({ pageParam }) => awsControlApi.driveList(account, "library", "", pageParam),
		initialPageParam: "",
		getNextPageParam: (last) => last.nextToken || void 0
	});
	const localQ = useAppQuery(["library", account], { queryFn: () => awsControlApi.library(account) });
	const bySlug = /* @__PURE__ */ new Map();
	for (const a of localQ.data?.artifacts ?? []) if (a.pushedAt !== null) bySlug.set(a.slug, a);
	const localAnswered = localQ.isSuccess;
	const slugs = (listQ.data?.pages ?? []).flatMap((pg) => pg.folders.map((f) => f.split("/").pop() ?? f));
	const pushable = (localQ.data?.artifacts ?? []).filter((a) => a.pushedVersion === null && a.kind !== "image");
	const onlyUnaddable = pushable.length === 0 && (localQ.data?.artifacts ?? []).some((a) => a.kind === "image");
	const nothingLocalYet = (localQ.data?.artifacts ?? []).length === 0;
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "library-section",
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(Library, { size: 18 }),
				title: i18nT("apps.awsControl.console.section_library"),
				actions: /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ jsx(ViewModeToggle, {
						section: "library",
						mode,
						onChange: setMode
					}), /* @__PURE__ */ jsxs(Btn, {
						primary: true,
						ref: addBtnRef,
						onClick: openPicker,
						"data-testid": "library-add-open",
						children: [/* @__PURE__ */ jsx(Plus, { size: 13 }), i18nT("apps.awsControl.console.library_add")]
					})]
				})
			}),
			!(listQ.isSuccess && slugs.length === 0) && /* @__PURE__ */ jsx("p", {
				className: "mb-3 text-[12px] text-muted",
				"data-testid": "library-blurb",
				children: i18nT("apps.awsControl.console.library_blurb")
			}),
			listQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 2 }),
			listQ.isError && /* @__PURE__ */ jsxs(Card, {
				className: "flex flex-col items-center gap-3 p-6",
				"data-testid": "library-error",
				children: [/* @__PURE__ */ jsx(AwsErrorNotice, {
					askAgent: true,
					error: listQ.error,
					message: i18nT("apps.awsControl.console.library_list_failed"),
					className: "w-full"
				}), /* @__PURE__ */ jsxs(Btn, {
					onClick: () => listQ.refetch(),
					"data-testid": "library-retry",
					children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("apps.awsControl.console.retry")]
				})]
			}),
			localQ.isError && /* @__PURE__ */ jsxs(Card, {
				className: "mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5",
				"data-testid": "library-local-error",
				children: [/* @__PURE__ */ jsx(AwsErrorNotice, {
					askAgent: true,
					error: localQ.error,
					message: i18nT("apps.awsControl.console.library_local_failed"),
					variant: "inline",
					className: "min-w-0 flex-1"
				}), /* @__PURE__ */ jsxs(Btn, {
					onClick: () => localQ.refetch(),
					"data-testid": "library-local-retry",
					children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("apps.awsControl.console.retry")]
				})]
			}),
			listQ.isSuccess && slugs.length === 0 && /* @__PURE__ */ jsx(EmptyState, {
				icon: /* @__PURE__ */ jsx(Library, {
					className: "h-10 w-10",
					"aria-hidden": "true"
				}),
				title: i18nT("apps.awsControl.console.library_empty_title"),
				subtitle: i18nT("apps.awsControl.console.library_empty_body"),
				testId: "library-empty",
				action: !localAnswered || nothingLocalYet ? void 0 : pushable.length > 0 ? /* @__PURE__ */ jsxs(Btn, {
					primary: true,
					onClick: openPicker,
					"data-testid": "library-empty-add",
					children: [/* @__PURE__ */ jsx(Plus, { size: 13 }), i18nT("apps.awsControl.console.library_add_count", { count: fmtNumber(pushable.length) })]
				}) : /* @__PURE__ */ jsx("p", {
					className: "text-[12px] text-muted",
					"data-testid": "library-empty-none",
					children: onlyUnaddable ? i18nT("apps.awsControl.console.library_not_pushable") : i18nT("apps.awsControl.console.library_add_nothing")
				})
			}),
			slugs.length > 0 && mode === "grid" && /* @__PURE__ */ jsx("div", {
				"data-testid": "library-grid",
				children: /* @__PURE__ */ jsx("div", {
					className: "grid items-start gap-3",
					style: { gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))" },
					children: slugs.map((slug) => /* @__PURE__ */ jsx(LibraryCloudCard, {
						slug,
						local: bySlug.get(slug),
						localAnswered,
						confirm: confirmSlug === slug ? confirmFor(slug, bySlug.get(slug)?.name || slug) : null,
						failed: failedSlugs.has(slug),
						failedWith: failedSlugs.get(slug),
						onAskRemove: () => askRemove(slug)
					}, slug))
				})
			}),
			slugs.length > 0 && mode === "list" && /* @__PURE__ */ jsx("div", {
				className: "rounded-md border border-border bg-card divide-y divide-border",
				"data-testid": "library-list",
				children: slugs.map((slug) => {
					const local = bySlug.get(slug);
					const stale = local && local.pushedVersion !== null && local.pushedVersion !== local.version;
					const RowInner = /* @__PURE__ */ jsxs(Fragment$1, { children: [
						/* @__PURE__ */ jsx(FileText, {
							size: 14,
							className: "shrink-0 text-muted",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "min-w-0 flex-1 truncate text-text",
							children: local?.name || slug
						}),
						stale && /* @__PURE__ */ jsx("span", {
							className: "min-w-0 text-[12px] text-warn",
							"data-testid": "library-list-stale",
							children: i18nT("apps.awsControl.console.library_stale_list", { version: local.pushedVersion })
						}),
						local?.pushedAt && /* @__PURE__ */ jsx("span", {
							className: "hidden shrink-0 text-[12px] text-muted lg:inline",
							children: i18nT("apps.awsControl.console.library_added", { when: fmtRelative(local.pushedAt) })
						}),
						local ? /* @__PURE__ */ jsx(Badge, {
							variant: "muted",
							children: i18nT(KIND_LABEL_KEY[local.kind])
						}) : localAnswered ? /* @__PURE__ */ jsx("span", {
							className: "text-[12px] text-muted",
							children: i18nT("apps.awsControl.console.library_cloud_only")
						}) : null,
						local && /* @__PURE__ */ jsxs("span", {
							className: "hidden shrink-0 font-mono text-[12px] text-muted sm:inline",
							children: ["v", local.pushedVersion ?? local.version]
						})
					] });
					const ROW = "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]";
					const title = local?.name || slug;
					const RowBody = local ? /* @__PURE__ */ jsx(Link, {
						to: `/artifacts/${slug}`,
						"aria-label": i18nT("apps.awsControl.console.library_open", { name: title }),
						className: `${ROW} min-w-0 flex-1 transition-colors hover:bg-bg-hover`,
						"data-testid": "library-list-row",
						children: RowInner
					}) : /* @__PURE__ */ jsx("div", {
						className: `${ROW} min-w-0 flex-1`,
						"data-testid": "library-list-row",
						children: RowInner
					});
					return /* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-1 pr-2",
							children: [RowBody, /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
								asChild: true,
								children: /* @__PURE__ */ jsx(IconButton, {
									"aria-label": i18nT("apps.awsControl.console.library_actions"),
									"data-testid": "library-more",
									children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
								})
							}), /* @__PURE__ */ jsx(DropdownMenuContent, {
								align: "end",
								children: /* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => askRemove(slug),
									"data-testid": "library-remove",
									children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.library_remove")]
								})
							})] })]
						}),
						failedSlugs.has(slug) && /* @__PURE__ */ jsx("div", {
							className: "px-3 pb-2",
							children: /* @__PURE__ */ jsx(AwsErrorNotice, {
								askAgent: true,
								error: failedSlugs.get(slug),
								message: i18nT("apps.awsControl.console.library_remove_failed"),
								variant: "inline",
								testId: "library-remove-error"
							})
						}),
						confirmSlug === slug && /* @__PURE__ */ jsx("div", {
							className: "px-3 pb-2.5",
							children: /* @__PURE__ */ jsx(TileConfirm, { ...confirmFor(slug, title) })
						})
					] }, slug);
				})
			}),
			listQ.hasNextPage && /* @__PURE__ */ jsx("div", {
				className: "mt-2",
				children: /* @__PURE__ */ jsx(Btn, {
					onClick: () => listQ.fetchNextPage(),
					disabled: listQ.isFetchingNextPage,
					"data-testid": "library-load-more",
					children: i18nT("apps.awsControl.console.load_more")
				})
			}),
			/* @__PURE__ */ jsx(CliDrawer, {
				bucket,
				prefix: "artifacts/"
			}),
			picking && /* @__PURE__ */ jsx(AddFromArtifactsDialog, {
				account,
				onClose: closePicker
			})
		]
	});
}
/** One artifact that IS in the cloud, as a preview card. */
function LibraryCloudCard({ slug, local, localAnswered, confirm, failed, failedWith, onAskRemove }) {
	const title = local?.name || slug;
	const showSlug = title !== slug;
	const body = /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("div", {
		className: "pointer-events-none",
		children: local ? /* @__PURE__ */ jsx(ArtifactPreview, {
			slug,
			kind: local.kind
		}) : localAnswered ? /* @__PURE__ */ jsx(OrphanThumb, {}) : /* @__PURE__ */ jsx("div", { className: "h-[120px] bg-bg-elevated" })
	}), /* @__PURE__ */ jsxs("div", {
		className: "p-3",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-start justify-between gap-2",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsx("div", {
					className: "truncate text-[13px] font-medium text-text-strong",
					children: title
				}), showSlug && /* @__PURE__ */ jsx("code", {
					className: "text-[11px] text-muted",
					children: slug
				})]
			}), /* @__PURE__ */ jsx("div", {
				className: "flex shrink-0 items-center gap-1",
				children: local && /* @__PURE__ */ jsx(Badge, {
					variant: "muted",
					children: i18nT(KIND_LABEL_KEY[local.kind])
				})
			})]
		}), local && /* @__PURE__ */ jsxs("div", {
			className: "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted",
			children: [/* @__PURE__ */ jsx("span", { children: local.pushedAt ? i18nT("apps.awsControl.console.library_added", { when: fmtRelative(local.pushedAt) }) : i18nT("apps.awsControl.console.library_in_cloud") }), local.pushedVersion !== null && local.pushedVersion !== local.version && /* @__PURE__ */ jsx("span", {
				className: "text-warn",
				"data-testid": "library-card-stale",
				children: i18nT("apps.awsControl.console.library_stale_preview", { version: local.pushedVersion })
			})]
		})]
	})] });
	const SHELL = "relative overflow-hidden rounded-lg border border-border bg-card";
	const openable = local ? /* @__PURE__ */ jsx(Link, {
		to: `/artifacts/${slug}`,
		"aria-label": i18nT("apps.awsControl.console.library_open", { name: title }),
		className: "block transition-colors hover:bg-bg-hover",
		children: body
	}) : /* @__PURE__ */ jsx("div", { children: body });
	return /* @__PURE__ */ jsxs("div", {
		className: SHELL,
		"data-testid": "library-card",
		children: [
			openable,
			/* @__PURE__ */ jsx("div", {
				className: "absolute right-2 top-2",
				children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
					asChild: true,
					children: /* @__PURE__ */ jsx(IconButton, {
						className: "bg-card/85 backdrop-blur-xs",
						"aria-label": i18nT("apps.awsControl.console.library_actions"),
						"data-testid": "library-more",
						children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
					})
				}), /* @__PURE__ */ jsx(DropdownMenuContent, {
					align: "end",
					children: /* @__PURE__ */ jsxs(DropdownMenuItem, {
						onSelect: onAskRemove,
						"data-testid": "library-remove",
						children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.library_remove")]
					})
				})] })
			}),
			failed && /* @__PURE__ */ jsx("div", {
				className: "px-3 pb-2",
				children: /* @__PURE__ */ jsx(AwsErrorNotice, {
					askAgent: true,
					error: failedWith,
					message: i18nT("apps.awsControl.console.library_remove_failed"),
					variant: "inline",
					testId: "library-remove-error"
				})
			}),
			confirm && /* @__PURE__ */ jsx("div", {
				className: "px-3 pb-3",
				children: /* @__PURE__ */ jsx(TileConfirm, { ...confirm })
			})
		]
	});
}
/**
* The picker: the local artifact library, with an action that copies one INTO
* the drive.
*
* This is where the local artifacts went when the Library folder stopped
* listing them. It is the drive's Upload equivalent, so it lives behind a
* button rather than occupying a folder: a reader browsing the drive is looking
* at what they have stored, and a list of candidates for storage is a different
* question that they ask deliberately.
*/
function AddFromArtifactsDialog({ account, onClose }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const [kind, setKind] = useState("all");
	const [q, setQ] = useState("");
	const backdropDown = useRef(false);
	/**
	* Escape, the Tab ring, the IME claim ordering and focus restore all come from
	* the shared hook.
	*
	* This dialog originally hand-rolled all four, and that was wrong twice over:
	* `useDialogFocusTrap` exists precisely so no dialog re-implements them, and
	* the copy had already drifted -- its focusable selector used a bare `select`,
	* omitted `summary`, and lacked the hook's `offsetParent` visibility filter, so
	* hidden controls were trappable in this one dialog and nowhere else. Reaching
	* for `useDocumentImeLatch` out of the same module while missing the hook next
	* to it is what made the drift invisible.
	*/
	const panelRef = useRef(null);
	useDialogFocusTrap(panelRef, onClose, { restoreFocus: false });
	const libQ = useAppQuery(["library", account], { queryFn: () => awsControlApi.library(account) });
	/**
	* Adds are tracked per slug, and deliberately NOT through `useMutation`.
	*
	* A `useMutation` observes ONE mutation at a time. Reading state off it
	* (`variables === slug`) meant a second Add reassigned the first card's
	* "Adding..."; keying that state by slug fixes the labels but NOT the outcome,
	* because starting a second add makes the observer stop tracking the first --
	* so the first add's rejection never reaches the hook's `onError` at all, and
	* a failed add stays invisible however carefully the label is keyed. Bulk
	* adding is this dialog's whole job (its own empty state advertises a count),
	* so two adds in flight is the common path, not an edge.
	*
	* Awaiting each add on its own is what actually makes one add's outcome
	* independent of every other's.
	*/
	const [addingSlugs, setAddingSlugs] = useState(/* @__PURE__ */ new Set());
	const [failedSlugs, setFailedSlugs] = useState(/* @__PURE__ */ new Map());
	const addOne = async (slug) => {
		setAddingSlugs((prev) => withSlug(prev, slug));
		setFailedSlugs((prev) => withoutFailure(prev, slug));
		try {
			await awsControlApi.libraryPush(account, slug);
			qc.invalidateQueries({ queryKey: appKey(["library", account]) });
			qc.invalidateQueries({ queryKey: appKey(["drive", account]) });
		} catch (err) {
			setFailedSlugs((prev) => withFailure(prev, slug, err));
		} finally {
			setAddingSlugs((prev) => withoutSlug(prev, slug));
		}
	};
	const artifacts = libQ.data?.artifacts ?? [];
	const counts = { all: artifacts.length };
	for (const k of KIND_KEYS) counts[k] = artifacts.filter((a) => a.kind === k).length;
	const needle = q.trim().toLowerCase();
	const shown = artifacts.filter((a) => kind === "all" ? true : a.kind === kind).filter((a) => needle ? a.name.toLowerCase().includes(needle) || a.slug.includes(needle) : true);
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-safe-or-4 sm:p-safe-or-8",
		"data-testid": "library-add-dialog",
		role: "presentation",
		onMouseDown: (e) => {
			if (e.target === e.currentTarget) backdropDown.current = true;
		},
		onClick: (e) => {
			if (e.target === e.currentTarget && backdropDown.current) onClose();
			backdropDown.current = false;
		},
		children: /* @__PURE__ */ jsxs("div", {
			ref: panelRef,
			className: "flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": i18nT("apps.awsControl.console.library_add"),
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3 border-b border-border px-4 py-3",
					children: [/* @__PURE__ */ jsx("h3", {
						className: "text-sm font-semibold text-text-strong",
						children: i18nT("apps.awsControl.console.library_add")
					}), /* @__PURE__ */ jsx(IconButton, {
						onClick: onClose,
						"aria-label": i18nT("apps.awsControl.console.close"),
						"data-testid": "library-add-close",
						children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
					})]
				}),
				/* @__PURE__ */ jsx("p", {
					className: "border-b border-border px-4 py-2 text-[12px] leading-snug text-text",
					"data-testid": "library-add-oneway",
					children: i18nT("apps.awsControl.console.library_add_oneway")
				}),
				/* @__PURE__ */ jsx("div", {
					className: "flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5",
					children: /* @__PURE__ */ jsxs("div", {
						className: "flex min-w-[180px] flex-1 items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40",
						children: [/* @__PURE__ */ jsx(Search, {
							size: 13,
							className: "shrink-0 text-muted",
							"aria-hidden": "true"
						}), /* @__PURE__ */ jsx("input", {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: i18nT("apps.awsControl.console.library_search"),
							"aria-label": i18nT("apps.awsControl.console.library_search"),
							autoFocus: true,
							className: "min-w-0 flex-1 border-none bg-transparent text-[13px] text-text outline-hidden",
							"data-testid": "library-add-search"
						})]
					})
				}),
				!libQ.isError && /* @__PURE__ */ jsx(RadioChipGroup, {
					className: "flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5",
					"data-testid": "library-chips",
					ariaLabel: i18nT("apps.awsControl.console.col_kind"),
					children: ["all", ...KIND_KEYS].filter((k) => k === "all" || k === kind || (counts[k] ?? 0) > 0).map((k) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setKind(k),
						...radioChip(kind === k),
						className: `cursor-pointer rounded-full border px-2.5 py-1 text-[12px] transition-colors ${kind === k ? "border-accent bg-accent/10 text-accent" : "border-border bg-transparent text-muted hover:text-text"}`,
						"data-testid": `library-chip-${k}`,
						children: [
							k === "all" ? i18nT("apps.awsControl.console.library_all") : i18nT(KIND_LABEL_KEY[k]),
							" ",
							/* @__PURE__ */ jsx("span", {
								className: "font-mono opacity-70",
								children: fmtNumber(counts[k] ?? 0)
							})
						]
					}, k))
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "min-h-0 flex-1 overflow-y-auto px-4 py-3",
					children: [
						libQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 3 }),
						libQ.isError && /* @__PURE__ */ jsxs("div", {
							className: "flex flex-col items-center gap-3 py-6",
							"data-testid": "library-add-error",
							children: [/* @__PURE__ */ jsx(AwsErrorNotice, {
								askAgent: true,
								error: libQ.error,
								message: i18nT("apps.awsControl.console.library_local_failed"),
								className: "w-full"
							}), /* @__PURE__ */ jsxs(Btn, {
								onClick: () => libQ.refetch(),
								"data-testid": "library-add-retry",
								children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("apps.awsControl.console.retry")]
							})]
						}),
						libQ.data && artifacts.length === 0 && /* @__PURE__ */ jsx("p", {
							className: "py-6 text-center text-[13px] text-muted",
							"data-testid": "library-add-empty",
							children: i18nT("apps.awsControl.console.library_add_empty")
						}),
						libQ.data && artifacts.length > 0 && shown.length === 0 && /* @__PURE__ */ jsx("p", {
							className: "py-6 text-center text-[13px] text-muted",
							"data-testid": "library-add-none",
							children: i18nT("apps.awsControl.console.library_add_none")
						}),
						shown.length > 0 && /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("div", {
							className: "grid items-start gap-3",
							style: { gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))" },
							children: shown.map((a) => /* @__PURE__ */ jsx(PickerCard, {
								artifact: a,
								onPush: () => {
									addOne(a.slug);
								},
								pushing: addingSlugs.has(a.slug),
								failed: failedSlugs.has(a.slug),
								failedWith: failedSlugs.get(a.slug)
							}, a.slug))
						}) })
					]
				})
			]
		})
	});
}
/** One candidate in the picker: a real preview, and one action. */
function PickerCard({ artifact, onPush, pushing, failed, failedWith }) {
	const synced = artifact.pushedVersion !== null;
	const upToDate = artifact.pushedVersion === artifact.version;
	const notPushable = artifact.kind === "image";
	return /* @__PURE__ */ jsxs("div", {
		className: "overflow-hidden rounded-lg border border-border bg-card",
		"data-testid": "library-tile",
		children: [/* @__PURE__ */ jsx("div", {
			className: "pointer-events-none",
			children: /* @__PURE__ */ jsx(ArtifactPreview, {
				slug: artifact.slug,
				kind: artifact.kind
			})
		}), /* @__PURE__ */ jsxs("div", {
			className: "p-3",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "min-w-0 flex-1 truncate text-[13px] font-medium text-text-strong",
						children: artifact.name
					}), /* @__PURE__ */ jsx(Badge, {
						variant: "muted",
						children: i18nT(KIND_LABEL_KEY[artifact.kind])
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "font-mono",
						children: ["v", artifact.version]
					}), /* @__PURE__ */ jsx("span", { children: fmtRelative(artifact.updatedAt) })]
				}),
				notPushable && /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-[11px] leading-snug text-muted",
					"data-testid": "library-not-pushable",
					children: i18nT("apps.awsControl.console.library_not_pushable")
				}),
				failed && !notPushable && /* @__PURE__ */ jsx(AwsErrorNotice, {
					askAgent: true,
					error: failedWith,
					message: i18nT("apps.awsControl.console.library_push_failed"),
					variant: "inline",
					className: "mt-2",
					testId: "library-push-error"
				}),
				!notPushable && /* @__PURE__ */ jsxs("div", {
					className: "mt-2.5",
					children: [upToDate && /* @__PURE__ */ jsx("p", {
						className: "mb-1.5 text-[11px] text-muted",
						"data-testid": "library-already",
						children: i18nT("apps.awsControl.console.library_in_cloud")
					}), /* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap items-center gap-2",
						children: /* @__PURE__ */ jsxs(Btn, {
							onClick: onPush,
							disabled: pushing,
							"data-testid": "library-push",
							children: [/* @__PURE__ */ jsx(Upload, { size: 13 }), pushing ? i18nT("apps.awsControl.console.library_adding") : upToDate ? i18nT("apps.awsControl.console.library_add_again") : synced ? i18nT("apps.awsControl.console.library_update") : i18nT("apps.awsControl.console.library_add_one")]
						})
					})]
				})
			]
		})]
	});
}
// src/host/viewState.ts
/**
* App view state — the small record that says WHERE the user was, owned by the host.
*
* A builtin page is unmounted on navigation (`BuiltinAppRoute` renders one lazy
* component under a catch-all route, and React Router tears it down when you leave),
* so component-local state returns to its defaults on every visit. This module is the
* platform's answer: an app declares the few coordinates worth restoring, and the host
* decides where they are written and what happens when they cannot be read back.
*
* Three properties are load-bearing, and each is a mechanism here rather than a
* convention the caller is trusted to follow:
*
* 1. THE NAMESPACE IS THE HOST'S. The key is `kc:app:<appId>:view`, with appId taken
*    from the identity context via `useTrustedAppId()`. An app never names its own
*    namespace, and cannot: the id it would have to supply is not a parameter.
*
* 2. THE DECLARATION IS A FILTER, NOT DOCUMENTATION. `pickDeclared` runs on every
*    write, so a field absent from `fields` cannot reach storage — passing a whole
*    component state in persists only the declared subset. This is what makes "do not
*    persist the drive's contents" enforced instead of merely written down, and it is
*    the shape shared by Zed's `should_serialize` and Codex rollout's
*    `is_persisted_rollout_item`.
*
* 3. THE FIRST READ IS SYNCHRONOUS. The record is read in a `useState` initializer, so
*    the restored value exists on the consumer's FIRST render and anything keyed off it
*    — a query key, most of all — is right the first time. Reading in an effect would
*    look correct on a cold visit, because a `React.lazy` child is still suspended while
*    its parent commits; on a repeat visit the module is already loaded, parent and child
*    render in one pass, and an effect is a render too late. A repeat visit is the case
*    this feature exists to serve, so the masking is not something to rely on. This is
*    the same ordering `identity.ts` publishes from a render body for, and it is why the
*    tests here assert the first render rather than the settled DOM.
*
* VERSIONING carries in the blob (`revision`), which is a new pattern in this frontend
* and deliberately so. The two shapes already here are a version in the KEY
* (`kc:file-explorer:state:v2`) and a tolerant partial parse that never versions at all
* (issue-radar's `loadUiState`). Neither fits a store the host owns on behalf of many
* apps: a version in the key makes the host's key FORMAT part of what every app has to
* know, and pushes a migration into each app's key string, whereas one field inside the
* record lets the store decide centrally and keeps the key a stable address.
*
* Imported by PATH and deliberately NOT re-exported from `./index`, following the
* reasoning `useComposerDraft` records there and `identity.ts` repeats: the barrel is
* what third-party apps resolve, held in exact agreement with
* `public/vendor/kirocrew-app-sdk.mjs`, so a name added to it is published and freezing
* a contract is easier than unfreezing one. There is nothing to publish yet — this store
* is builtin-only BY CONSTRUCTION (see `useTrustedAppId`), so in a third-party app it
* would be a hook that never persists anything.
*/
/**
* This app's id, fixed. The dashboard's copy reads it from the host's identity context
* (`useTrustedAppId`), which grants a namespace to built-in pages only. The record lives
* at the same `kc:app:aws-control:view` key the built-in wrote, so a folder a user left
* open before adoption is restored after it.
*/
var APP_ID = "aws-control";
function useTrustedAppId() {
	return APP_ID;
}
function safeGetItem(key) {
	try {
		if (typeof localStorage === "undefined") return null;
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function safeSetItem(key, value) {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(key, value);
	} catch {}
}
function safeRemoveItem(key) {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.removeItem(key);
	} catch {}
}
/**
* Charset for a key segment: non-empty, lowercase alphanumerics and `-`.
*
* Mirrors the appId rule in `apps/appIdentity.ts` for the same reason — `.`/`..` and the
* separators are refused BY the charset, because a segment that can contain them can
* address a namespace other than its own. Kept local rather than imported from `apps/`:
* nothing in `app-sdk/` depends on that directory today, and a store should not acquire a
* dependency on host registration machinery to spell one regex.
*/
var KEY_SEGMENT_RE = /^[a-z0-9-]+$/;
/**
* The host-owned key for one surface's view record, within one scope.
*
* `appId` has already cleared `isValidAppId` at registration, which is where an id becomes
* a key segment. `name` has not been anywhere, so it is checked here.
*
* `scope` is DATA — an account id, a project — so it is encoded rather than validated. A
* throw would be wrong for a value the user's environment supplies, and encoding is what
* makes it safe: `encodeURIComponent` escapes `:`, so a scope cannot forge a segment
* boundary and land in another scope's key.
*
* Scope lives in the key rather than inside the record for the same reason `name` does:
* it makes the isolation structural instead of a comparison someone can forget. It also
* means each scope keeps its OWN position, so a user working across two accounts finds
* both folders where they left them — which a single record tagged with one scope could
* not do, because whichever account was used last would overwrite the other.
*
* Growth is one small record per scope the user actually visits. That bounds it in
* practice for a scope like an account, and it is the contract this key shape implies:
* `scope` names a subject the user CHOOSES AMONG, not a per-item id. A high-cardinality
* scope would accumulate records.
*
* Throws on a bad `name` rather than sanitizing, following `AppScopedApiProvider`'s
* precedent in this same layer: `name` is authored in code as part of a module-level
* declaration and is never data, so a bad one is a developer error that should fail
* immediately and identically on every machine.
*/
function viewStateKey(appId, name, scope) {
	if (!KEY_SEGMENT_RE.test(name)) throw new Error(`[app-sdk] view-state name ${JSON.stringify(name)} is not a valid key segment (lowercase letters, digits and '-' only). It names a storage key, not a label.`);
	const base = `kc:app:${appId}:view:${name}`;
	return scope ? `${base}:${encodeURIComponent(scope)}` : base;
}
/** A declared string field. The common case, and the only one AWS Control needs. */
function isViewString(value) {
	return typeof value === "string";
}
/**
* Declared field names in a stable order.
*
* Sorted rather than left in authoring order so the serialized record is byte-stable
* for a given state regardless of how the declaration was written — which is what lets
* `isDefaultState` compare two records by their serialization instead of walking them.
*/
function declaredFields(decl) {
	return Object.keys(decl.fields).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
/**
* Keep only the declared fields of `candidate` whose values clear their guard.
*
* This is the write-side gate, and it is the reason an app cannot persist wholesale:
* anything not in `decl.fields` is not copied, so handing this a component's entire
* state object yields only the coordinates. Deleting this call is what a test must
* catch — see the drive-contents case in `viewState.test.ts`.
*/
function pickDeclared(decl, candidate) {
	const out = {};
	if (candidate === null || typeof candidate !== "object") return out;
	const src = candidate;
	for (const field of declaredFields(decl)) {
		const name = field;
		if (!(name in src)) continue;
		const value = src[name];
		if (decl.fields[field](value)) out[field] = value;
	}
	return out;
}
/**
* The declared subset of `state`, merged over the defaults, serialized in a stable field
* order.
*
* Merging matters: a state that simply does not mention a field IS that field's default,
* so `{}` and `{path: ''}` have to canonicalize the same way or `isDefaultState` would
* call an unset field a position worth storing.
*
* The restriction to declared fields is STRUCTURAL here, not a filter call: the loop
* iterates `declaredFields(decl)` and copies nothing else, so an undeclared field cannot
* reach the output whatever `state` contains. A `pickDeclared` call used to sit on the
* merge as well, and it was removed as redundant -- every path in already carries filtered
* values (`setView` filters a patch, `parseViewState` accepts only guard-passing fields),
* so it could not change any output, which also means no test could observe it.
*/
function canonicalState(decl, state) {
	const merged = {
		...decl.defaults,
		...state
	};
	const ordered = {};
	for (const field of declaredFields(decl)) ordered[field] = merged[field];
	return JSON.stringify(ordered);
}
/**
* Whether `state` carries nothing worth remembering.
*
* The store keeps a record only while there IS a position: returning to the defaults
* removes the key rather than writing a record that says "nowhere in particular". That
* keeps a visit to an app from leaving a row behind, and it makes discarding a stale
* record the same operation as saving a default one — one path, not two.
*/
function isDefaultState(decl, state) {
	return canonicalState(decl, state) === canonicalState(decl, decl.defaults);
}
/** Serialize a record for storage. Only declared fields survive. */
function serializeViewRecord(decl, state) {
	return `{"revision":${JSON.stringify(decl.revision)},"state":${canonicalState(decl, state)}}`;
}
/**
* Read a stored record into a complete state, or fall back to the defaults.
*
* Every rejection lands on the same answer — mount with the defaults — because a
* changed schema must never be able to stop a page from mounting. That is Zed's
* behaviour with an unknown item kind: drop the tab, do not crash the workspace.
*
* A declared field that is PRESENT but fails its guard rejects the WHOLE record rather
* than just that field. One rule ("a record either validates or it is discarded") is
* predictable in a way that "some fields may survive" is not — a half-restored position
* is a state the app was never written to handle, and the corrupt case is not one worth
* salvaging.
*/
function parseViewState(raw, decl) {
	if (raw === null) return {
		state: decl.defaults,
		outcome: "absent"
	};
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			state: decl.defaults,
			outcome: "unreadable"
		};
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {
		state: decl.defaults,
		outcome: "unreadable"
	};
	const record = parsed;
	if (record.revision !== decl.revision) return {
		state: decl.defaults,
		outcome: "revision-mismatch"
	};
	if (record.state === null || typeof record.state !== "object" || Array.isArray(record.state)) return {
		state: decl.defaults,
		outcome: "unreadable"
	};
	const src = record.state;
	const accepted = {};
	for (const field of declaredFields(decl)) {
		const name = field;
		if (!(name in src)) continue;
		const value = src[name];
		if (!decl.fields[field](value)) return {
			state: decl.defaults,
			outcome: "unreadable"
		};
		accepted[field] = value;
	}
	return {
		state: {
			...decl.defaults,
			...accepted
		},
		outcome: "restored"
	};
}
/**
* Decide what storage should hold for a given live state.
*
* Two cases, because the scope is in the key: a record can only ever be OUR scope's
* record, so there is no question of whose position a delete would take. That is what
* moving scope out of the record bought — this function previously had to read what was
* already stored, parse it, and compare its scope tag before it could tell a reset of our
* own position from the destruction of another account's.
*
* A default state removes the key rather than storing a record that says "nowhere in
* particular", so a visit that goes nowhere leaves nothing behind, and discarding a stale
* record is the same operation as saving a default one.
*/
function resolveViewStateWrite(decl, state) {
	if (isDefaultState(decl, state)) return { action: "remove" };
	return {
		action: "write",
		raw: serializeViewRecord(decl, state)
	};
}
/** Keys already reported as unreadable, so one corrupt record warns once. */
var unreadableLogged = /* @__PURE__ */ new Set();
/**
* Report why a mount did not restore, at a level matched to what the reader can do.
*
* A scope mismatch is ROUTINE — it fires every time the user switches account — so it
* is silent; logging it would train everyone to ignore the channel. A revision mismatch
* happens only after someone deliberately changed the schema, and one debug line there
* costs nothing and answers "why did everyone's position reset" immediately. An
* unreadable record is the only genuine fault: something wrote garbage under a
* host-owned key, so it warns — once per key, following the ledger `useTrustedAppId`
* already keeps for a refused namespace, because a refusal repeated every render drowns
* out real signal.
*/
function reportViewOutcome(key, outcome) {
	if (outcome === "revision-mismatch") {
		console.debug(`[app-sdk] view state at ${key} was written under another revision; mounting with defaults`);
		return;
	}
	if (outcome === "unreadable") {
		if (unreadableLogged.has(key)) return;
		unreadableLogged.add(key);
		console.warn(`[app-sdk] view state at ${key} could not be read; mounting with defaults and discarding it`);
	}
}
function readSnapshot(key, decl) {
	if (key === null) return {
		key,
		state: decl.defaults,
		outcome: "absent"
	};
	const parsed = parseViewState(safeGetItem(key), decl);
	return {
		key,
		state: parsed.state,
		outcome: parsed.outcome
	};
}
/**
* Restore and persist an app's declared view state.
*
* `opts.scope` is the thing the coordinates are coordinates WITHIN — the AWS account
* for a drive path, and whatever plays that role for the next consumer. It is
* first-class rather than left to each caller because a mismatched scope has to resolve
* to the defaults through the SAME path as a mismatched revision: one implementation of
* "mount with defaults" covering both, instead of the store handling one and every app
* hand-rolling the other. A caller who forgot that comparison would restore a position
* taken in one account into a different account's bucket, and the failure is silent.
*
* A scope CHANGE is handled here too, by re-reading during render (React's documented
* "adjusting state when a prop changes" pattern) rather than in an effect. Without it,
* a caller whose scope changes without a remount would carry the old position forward
* and the next write would store it labelled with the NEW scope — the record would state
* something false. Doing it in the hook makes that unreachable for every consumer
* instead of depending on each one remembering to remount.
*/
function useAppViewState(decl, opts) {
	const key = viewStateKey(useTrustedAppId(), decl.name, opts?.scope);
	const [snapshot, setSnapshot] = useState(() => readSnapshot(key, decl));
	let active = snapshot;
	if (snapshot.key !== key) {
		active = readSnapshot(key, decl);
		setSnapshot(active);
	}
	const setView = useCallback((patch) => {
		setSnapshot((prev) => ({
			...prev,
			state: {
				...prev.state,
				...pickDeclared(decl, patch)
			}
		}));
	}, [decl]);
	const { state, outcome } = active;
	useEffect(() => {
		if (key === null) return;
		reportViewOutcome(key, outcome);
	}, [key, outcome]);
	useEffect(() => {
		if (key === null) return;
		const write = resolveViewStateWrite(decl, state);
		if (write.action === "write") safeSetItem(key, write.raw);
		else safeRemoveItem(key);
	}, [
		key,
		decl,
		state
	]);
	return [state, setView];
}
// src/host/useMenuOpensDialog.ts
/**
* Hand focus from a closing Radix menu (DropdownMenu / ContextMenu) to the
* layer one of its items opened, and back to the menu's opener afterwards.
*
* Two Radix behaviours meet here, one macrotask apart:
*
*   1. Item select is dispatched with `flushSync`, so a layer set from
*      `onSelect` mounts in a commit where the menu's FocusScope is STILL
*      trapping focus. The layer focuses itself, the trap yanks focus straight
*      back into a menu that then unmounts, and focus is stranded on `body`.
*      `openLayer` therefore defers the open by one macrotask
*      (`setTimeout(…, 0)`), past the menu's own close commit.
*   2. When the menu content unmounts, its FocusScope schedules the restore to
*      the trigger one macrotask later and fires `onCloseAutoFocus` from that
*      task. By then the layer owns focus, so restoring the trigger would steal
*      it (a dialog loses its focus; an inline input blurs and cancels the
*      edit). An item that opened a layer arms a one-shot flag, and the menu's
*      `onCloseAutoFocus` consumes it and calls `preventDefault()`.
*
* Because the trigger restore was suppressed, a dialog hands focus back itself
* on close: call `returnFocus()` from its close path. An inline editor that
* owns focus while mounted (a rename field) has no close hand-back and only
* needs `armSkipRestore()`.
*
* Usage:
*   - `rememberOpener` on the trigger's `onPointerDown` / `onKeyDown`. It reads
*     `currentTarget` from the trigger's own event rather than
*     `document.activeElement`: Safari does not focus a button on pointer
*     click, so the active element would still be whatever had focus before.
*   - `onCloseAutoFocus` on the menu content. It returns whether it consumed
*     an armed flag, so a site with its own fallback (e.g. skip the restore
*     after a pointer dismissal) can run that only when it returns false.
*   - `openLayer(() => setDialog(…))` from the item's `onSelect` for a dialog
*     or picker; `armSkipRestore()` for a layer that mounts in the same commit
*     and grabs focus on its own next frame.
*   - `disarm()` when the caller knows no suppression can be pending, as a
*     guard against a menu dismissed without firing `onCloseAutoFocus`.
*
* Every returned function has a stable identity, so passing them to memoized
* rows does not invalidate those rows.
*/
function useMenuOpensDialog() {
	const openerRef = useRef(null);
	const armedRef = useRef(false);
	return {
		rememberOpener: useCallback((e) => {
			openerRef.current = e.currentTarget;
		}, []),
		armSkipRestore: useCallback(() => {
			armedRef.current = true;
		}, []),
		openLayer: useCallback((open) => {
			armedRef.current = true;
			setTimeout(open, 0);
		}, []),
		onCloseAutoFocus: useCallback((e) => {
			if (!armedRef.current) return false;
			armedRef.current = false;
			e.preventDefault();
			return true;
		}, []),
		disarm: useCallback(() => {
			armedRef.current = false;
		}, []),
		returnFocus: useCallback(() => {
			openerRef.current?.focus({ preventScroll: true });
		}, [])
	};
}
// src/host/useScrollEdges.ts
/**
* Which edges of a horizontal scroller hide content, measured rather than
* inferred from a breakpoint — a strip inside a resizable pane overflows at
* widths the viewport knows nothing about.
*
* This exists because a scroller with a hidden scrollbar reads as COMPLETE: the
* row simply ends, and nothing says four of seventeen tabs are on screen. The
* caller paints an edge cue from these flags so the clipping is visible, which
* is the signal a horizontal overflow needs (a hidden scrollbar leaves none,
* and a tooltip or a scroll-position dot is not a substitute on touch).
*
* Physical `left`/`right`, not logical start/end: every shipped locale is LTR,
* so a logical mapping would be untested indirection.
*
* Returns a CALLBACK ref, and that is load-bearing: the scroller can mount
* later than the component holding this hook — a strip that exists only below a
* breakpoint appears on a mid-session resize, long after mount. A mount-only
* effect would see a null node, attach nothing, and never run again, leaving the
* cues frozen while the reader scrolls. Binding from the ref callback attaches
* whenever the node arrives and detaches when it leaves.
*
* `remeasure` is for content changes no observer reports — the scroller keeps
* its own box while its children change, e.g. a tab appearing behind a flag.
*
* `attachContent` (the fourth slot) is for the AUTO-SIZED case `remeasure`
* cannot close: an auto-layout table's scrollWidth moves whenever its rows
* re-render wider or narrower — a filter emptying rows, a locale switch
* re-labelling every header, a webfont finishing load — none of which resize
* the scroller's own box or announce themselves to the caller. The content
* node's border-box IS the overflow driver, so observing it subsumes all of
* them in one mechanism. Optional: scrollers whose overflow only moves with
* their own box (fixed-layout tables, inline chip strips that call
* `remeasure` on data changes) never attach one.
*/
function useScrollEdges() {
	const elRef = useRef(null);
	const detachRef = useRef(null);
	const detachContentRef = useRef(null);
	const [edges, setEdges] = useState({
		left: false,
		right: false
	});
	const remeasure = useCallback(() => {
		const el = elRef.current;
		if (!el) return;
		const hidden = el.scrollWidth - el.clientWidth;
		const scrolled = el.scrollLeft;
		const next = {
			left: scrolled > 1,
			right: hidden - scrolled > 1
		};
		setEdges((prev) => prev.left === next.left && prev.right === next.right ? prev : next);
	}, []);
	return [
		useCallback((node) => {
			detachRef.current?.();
			detachRef.current = null;
			elRef.current = node;
			if (!node) {
				setEdges({
					left: false,
					right: false
				});
				return;
			}
			remeasure();
			node.addEventListener("scroll", remeasure, { passive: true });
			const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
			ro?.observe(node);
			detachRef.current = () => {
				node.removeEventListener("scroll", remeasure);
				ro?.disconnect();
			};
		}, [remeasure]),
		edges,
		remeasure,
		useCallback((node) => {
			detachContentRef.current?.();
			detachContentRef.current = null;
			if (!node) return;
			remeasure();
			const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
			ro?.observe(node);
			detachContentRef.current = () => ro?.disconnect();
		}, [remeasure])
	];
}
// src/useDrivePageFiles.ts
/**
* AWS Control drive - the Files pane's state: the open folder (restored from the
* app's view state), the paged listing, search, and the requests the pane's own
* controls make (upload, delete, folder create and delete, move, rename, download),
* together with the drag-and-drop wiring and the menu-to-dialog focus hand-back.
* The preview and share dialogs (`DrivePageFileDialogs.tsx`) make their own.
*
* `DriveSectionView` (`DrivePageFiles.tsx`) calls `useDrivePageFiles` once per
* render, as its only hook, so the pane registers its hooks in one fixed order.
* The pane's views (`DrivePageFilesViews.tsx`) read the same object,
* `DriveFilesPane`.
*/
/** Client-side key-segment validation, matching the backend's charset rule. */
var KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9 ._()+@=-]*$/;
/** How long the row a search hit landed on stays marked, counted from the
*  moment the row APPEARS (the listing behind "Open containing folder" is a
*  CLI round-trip, so counting from the click could spend the window before
*  there is anything to mark). Long enough to find with the eye, short enough
*  that it never reads as a selection. */
var HIT_HIGHLIGHT_MS = 4e3;
/**
* What the drive restores when you come back to it.
*
* One field. The rest of "where I was" is already durable elsewhere and deliberately
* stays there: the pane is in the URL (`usePaneFromPath`), the grid/list choice is in
* `useViewMode`, and the selected account is in `awsControl.selectedAccount` — which is
* this record's SCOPE rather than one of its fields, so a prefix can never be restored
* into a bucket it was not taken in.
*
* The listing itself is not here and cannot be: `contents` is not a declared field, so
* `pickDeclared` drops it on write even if a caller passes it in. Server-owned data is
* refetched, per the design's three-tier ownership split.
*
* Module-level, so the hook sees one stable declaration rather than a new object per
* render.
*/
var DRIVE_VIEW = {
	name: "drive",
	revision: 1,
	fields: { path: isViewString },
	defaults: { path: "" }
};
/**
* The Files pane's state for one account's drive, as one object. The body is the
* pane's own: the order of its hooks is the order the pane registers them in.
*/
function useDrivePageFiles(account) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const [mode, setMode] = useViewMode("drive", "list");
	const [view, setView] = useAppViewState(DRIVE_VIEW, { scope: account });
	const path = view.path;
	const setPath = useCallback((next) => setView({ path: next }), [setView]);
	const [share, setShare] = useState(null);
	const [uploadError, setUploadError] = useState(null);
	/** Keyed by the object whose download failed, so the preview dialog shows
	*  only ITS failure: a lingering error from file A must not surface inside
	*  a later preview of file B as if B's download had failed. */
	const [downloadError, setDownloadError] = useState(null);
	const [preview, setPreview] = useState(null);
	const [renaming, setRenaming] = useState(null);
	/** Mirror of `renaming` for the rename mutation's callbacks, which fire
	*  after the request and would otherwise read the row that was open when
	*  the mutation was created, not the one open now. */
	const renamingRef = useRef(null);
	useEffect(() => {
		renamingRef.current = renaming;
	}, [renaming]);
	const [renameValue, setRenameValue] = useState("");
	const [renameError, setRenameError] = useState("");
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	useEffect(() => {
		if (!query.trim()) {
			setDebouncedQuery("");
			return;
		}
		const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
		return () => clearTimeout(t);
	}, [query]);
	/** The file a search hit's "Open containing folder" landed on. The listing
	*  scrolls it into view and marks it for a few seconds so the reader is not
	*  left re-finding it by eye in a large folder. Cleared on a timer that runs
	*  from the moment the ROW appears, by the next search, and by navigating to
	*  a folder that is not the file's own. */
	const [highlightKey, setHighlightKey] = useState(null);
	const highlightTimer = useRef(null);
	const highlightRef = useCallback((node) => {
		if (!node) return;
		node.scrollIntoView?.({ block: "center" });
		node.focus({ preventScroll: true });
		if (highlightTimer.current) clearTimeout(highlightTimer.current);
		highlightTimer.current = setTimeout(() => setHighlightKey(null), HIT_HIGHLIGHT_MS);
	}, []);
	useEffect(() => () => {
		if (highlightTimer.current) clearTimeout(highlightTimer.current);
	}, []);
	useEffect(() => {
		if (highlightKey && highlightKey.split("/").slice(0, -1).join("/") !== path) setHighlightKey(null);
	}, [path, highlightKey]);
	const highlighted = (key) => highlightKey === key;
	const highlightProps = (key) => highlighted(key) ? {
		ref: highlightRef,
		"data-highlighted": "true",
		tabIndex: -1
	} : {};
	const [confirmDelete, setConfirmDelete] = useState(null);
	/** Mirror of `confirmDelete` for the delete mutation's callbacks, which fire
	*  after the request and must know which row's strip is open NOW. */
	const confirmDeleteRef = useRef(null);
	useEffect(() => {
		confirmDeleteRef.current = confirmDelete;
	}, [confirmDelete]);
	const [confirmFolder, setConfirmFolder] = useState(null);
	const [newFolder, setNewFolder] = useState("");
	/** Folder-name input is a disclosure: visible only after "New folder". */
	const [creatingFolder, setCreatingFolder] = useState(false);
	const [folderError, setFolderError] = useState("");
	/** The "New folder" button the disclosure replaces. When the disclosure
	*  closes it unmounts the input and both buttons, and focus falls to `<body>`
	*  unless it is handed somewhere — so it goes back to the control that opened
	*  it, which is where the reader was. The effect runs on the close EDGE
	*  only: on the first render nothing was open, and a reader who never used
	*  the keyboard must not have their focus yanked to a toolbar button. */
	const folderToggleRef = useRef(null);
	const wasCreatingFolder = useRef(false);
	useEffect(() => {
		if (wasCreatingFolder.current && !creatingFolder) folderToggleRef.current?.focus({ preventScroll: true });
		wasCreatingFolder.current = creatingFolder;
	}, [creatingFolder]);
	/** The folder-name field, and a request to focus it after the next commit.
	*  The Move picker's New folder action cannot rely on the field's
	*  `autoFocus`: when the field is already open (it keeps a typed name across
	*  a blur), it does not remount, and focus would fall to `<body>` as the
	*  picker unmounts. A counter, so a second request also runs the effect. */
	const folderNameRef = useRef(null);
	const [folderNameFocusRequest, setFolderNameFocusRequest] = useState(0);
	useEffect(() => {
		if (folderNameFocusRequest) folderNameRef.current?.focus({ preventScroll: true });
	}, [folderNameFocusRequest]);
	/** The file a "Move to folder…" picker is open for, or null. */
	const [moveTarget, setMoveTarget] = useState(null);
	/** Who opened the row menu that is closing, and whether one of its items
	*  opened a dialog: the Share and Move dialogs open one macrotask after the
	*  menu closes and hand focus back to the opener themselves. The ordering
	*  this relies on is documented on `useMenuOpensDialog`. */
	const menuLayer = useMenuOpensDialog();
	const rememberMenuOpener = menuLayer.rememberOpener;
	const skipRestoreIfDialog = menuLayer.onCloseAutoFocus;
	const openShare = (key) => {
		menuLayer.openLayer(() => setShare({ key }));
	};
	const openMove = (key) => {
		moveDialogOpenRef.current = true;
		setMoveError(null);
		menuLayer.openLayer(() => setMoveTarget(key));
	};
	const returnFocusToOpener = menuLayer.returnFocus;
	/** The rename field took focus from its menu, so closing it would leave
	*  focus on `body`. Hand it back to the menu's opener once the field has
	*  unmounted, unless the reader has already moved focus somewhere else. */
	const returnFocusIfDropped = () => {
		requestAnimationFrame(() => {
			const active = document.activeElement;
			if (!active || active === document.body) returnFocusToOpener();
		});
	};
	/** Whether the Move picker is on screen, readable from a mutation callback
	*  that may fire after the reader has already dismissed it. */
	const moveDialogOpenRef = useRef(false);
	/** How the Move picker closes — Escape, X, backdrop, or a landed move.
	*  Never refused: a move still in flight keeps running without it. */
	const closeMoveDialog = () => {
		moveDialogOpenRef.current = false;
		setMoveTarget(null);
		setMoveError(null);
		returnFocusToOpener();
	};
	/** The picker's empty state ("no other folder here") offers New folder. It
	*  closes the picker and opens the toolbar's own folder-name field rather
	*  than growing a second create form inside the picker: the field is the one
	*  write path for folders. Focus goes to that field (whether it was just
	*  opened or already open), not back to the row menu's opener. No move can
	*  be in flight here — an empty picker has no destination to start one. */
	const moveToNewFolder = () => {
		moveDialogOpenRef.current = false;
		setMoveTarget(null);
		setMoveError(null);
		setCreatingFolder(true);
		setFolderNameFocusRequest((n) => n + 1);
	};
	/** The ONE way out of the folder disclosure (Escape, Cancel, blur-on-empty),
	*  carrying the whole close invariant: (1) it refuses while a create is in
	*  flight — collapsing mid-request would erase the very name being created,
	*  so a failure comes back to a wiped input; (2) when it does close, it
	*  clears ALL creation state — the name, the validation error, and the
	*  mutation's own error — because any of the three left behind renders as an
	*  orphan under a toolbar whose input is gone. */
	const closeFolderDisclosure = () => {
		if (folderCreateMut.isPending) return;
		setNewFolder("");
		setFolderError("");
		folderCreateMut.reset();
		setCreatingFolder(false);
	};
	/** Whether a notice on THIS pane may hand off to the agent. The folder-name
	*  field and an open rename editor are the two drafts the pane can hold, and
	*  every notice here — a failed listing, search, upload, move, download or
	*  delete — shares the screen with them while either is open. Gated on the
	*  disclosure / editor being open rather than on the field having text, so
	*  the button does not flicker in and out as the reader types. */
	const handOff = !creatingFolder && renaming === null;
	const [deleted, setDeleted] = useState(null);
	/** The "Deleted N files" line belongs to the folder it happened in — the
	*  deleted folder's PARENT, taken from the request rather than from the path
	*  at response time, so a reader who navigated while the delete ran does not
	*  find the count in the folder they landed in. It shows only while that
	*  folder is the current path, and leaving the folder RETIRES it (rather than
	*  merely hiding it), so coming back later does not replay it. */
	const deletedHere = deleted && deleted.inPath === path ? deleted : null;
	useEffect(() => {
		setDeleted((d) => d && d.inPath !== path ? null : d);
	}, [path]);
	const fileRef = useRef(null);
	const [attachScroller, edges] = useScrollEdges();
	const listQ = useInfiniteQuery({
		queryKey: appKey([
			"drive",
			account,
			"list",
			"drive",
			path
		]),
		queryFn: ({ pageParam }) => awsControlApi.driveList(account, "drive", path, pageParam),
		initialPageParam: "",
		getNextPageParam: (last) => last.nextToken || void 0
	});
	const folders = (listQ.data?.pages ?? []).flatMap((pg) => pg.folders);
	const files = (listQ.data?.pages ?? []).flatMap((pg) => pg.files);
	useEffect(() => {
		if (!highlightKey || !listQ.data) return;
		if (highlightKey.split("/").slice(0, -1).join("/") !== path) return;
		if (files.some((f) => f.key === highlightKey)) return;
		if (listQ.hasNextPage && !listQ.isFetchingNextPage) listQ.fetchNextPage();
	}, [
		highlightKey,
		path,
		listQ.data,
		listQ.hasNextPage,
		listQ.isFetchingNextPage
	]);
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: appKey(["drive", account]) });
		qc.invalidateQueries({ queryKey: appKey(["drive-search", account]) });
	};
	const uploadMut = useMutation({
		mutationFn: ({ file, key }) => awsControlApi.driveUpload(account, "drive", key, file),
		onSuccess: invalidate,
		onError: (e, vars) => {
			setUploadError({
				message: i18nT("apps.awsControl.console.drive_upload_failed", { name: vars.key.split("/").pop() ?? vars.key }),
				error: e
			});
		}
	});
	const deleteMut = useMutation({
		mutationFn: (key) => awsControlApi.driveDelete(account, "drive", key),
		onMutate: () => setPageError(null),
		onSuccess: invalidate,
		onError: (e, key) => {
			if (confirmDeleteRef.current === key) return;
			setPageError({
				message: i18nT("apps.awsControl.console.delete_failed_named", { name: key.split("/").pop() ?? key }),
				error: e
			});
		}
	});
	/** The one way a delete confirmation strip opens. The strip renders
	*  `deleteMut.error` inline, and the mutation is shared by every row, so a
	*  failed delete on file A would otherwise sit pre-rendered under a strip
	*  opened later on file B -- "Delete failed" before anything was tried. The
	*  reset is skipped while a delete is still flying: it would drop that
	*  request's pending state, not the stale error this is for. */
	const openConfirmDelete = (key) => {
		if (!deleteMut.isPending) deleteMut.reset();
		setConfirmDelete(key);
	};
	/** Whether the shared delete mutation's error belongs to THIS row. Opening a
	*  strip on file B while A's delete is still flying is allowed; when A then
	*  fails, its error goes to the page-level notice (onError above) and must
	*  not also surface under B's strip just because the mutation is shared. */
	const deleteFailedFor = (key) => deleteMut.isError && deleteMut.variables === key;
	const folderCreateMut = useMutation({
		mutationFn: (name) => awsControlApi.driveFolderCreate(account, "drive", path ? `${path}/${name}` : name),
		onSuccess: () => {
			setNewFolder("");
			setCreatingFolder(false);
			invalidate();
		}
	});
	const folderDeleteMut = useMutation({
		mutationFn: (folder) => awsControlApi.driveFolderDelete(account, "drive", folder),
		onSuccess: (res, folder) => {
			const parts = folder.split("/");
			setDeleted({
				count: res.objects,
				name: parts[parts.length - 1] ?? folder,
				inPath: parts.slice(0, -1).join("/")
			});
			invalidate();
		}
	});
	const onCreateFolder = () => {
		const name = newFolder.trim();
		setFolderError("");
		if (!name) return;
		if (!KEY_SEGMENT.test(name)) {
			setFolderError(i18nT("apps.awsControl.console.folder_bad_name"));
			return;
		}
		folderCreateMut.mutate(name);
	};
	const onPick = (file) => {
		if (!file) return;
		setUploadError(null);
		if (!KEY_SEGMENT.test(file.name)) {
			setUploadError({ message: i18nT("apps.awsControl.console.drive_bad_name") });
			return;
		}
		uploadMut.mutate({
			file,
			key: path ? `${path}/${file.name}` : file.name
		});
	};
	/** Upload dropped OS files into `folder` ('' = the open folder's own path).
	*  Invalid names surface through the same strip the picker uses — but NAMED:
	*  a 10-file drop can fail on one file while the rest upload, and the
	*  picker's anonymous "that file name" would not say which one. */
	const uploadDropped = (list, folder) => {
		setUploadError(null);
		for (const file of Array.from(list)) {
			if (!KEY_SEGMENT.test(file.name)) {
				setUploadError({ message: i18nT("apps.awsControl.console.drive_bad_name_named", { name: file.name }) });
				continue;
			}
			const prefix = folder || path;
			uploadMut.mutate({
				file,
				key: prefix ? `${prefix}/${file.name}` : file.name
			});
		}
	};
	/** Which drop target the pointer is over: '' is the listing itself (the open
	*  folder), a folder's full path names that folder. Null = no drag in
	*  flight. Drives the highlight only — the drop handlers re-derive their own
	*  target so a missed dragleave cannot misroute a drop. */
	const [dropTarget, setDropTarget] = useState(null);
	/** The most recent refused move. One slot is enough: moves are serialized
	*  (see `moveBusy`), so a refusal can only ever belong to the last move. */
	const [moveError, setMoveError] = useState(null);
	/** A delete or rename that failed after its row's own strip was gone. Kept
	*  apart from `moveError` because the Move picker renders that slot as its
	*  refusal: sharing it would show "could not delete X" inside a picker that
	*  is moving Y. The page strip carries this one whether or not the picker
	*  is open. */
	const [pageError, setPageError] = useState(null);
	const moveMut = useMutation({
		mutationFn: ({ fromKey, toKey }) => awsControlApi.driveMove(account, "drive", fromKey, toKey),
		onSuccess: () => {
			setMoveError(null);
			qc.invalidateQueries({ queryKey: appKey(["drive-list", account]) });
			invalidate();
		},
		onError: (e) => {
			const err = e instanceof AwsControlError ? e : null;
			setMoveError({
				message: i18nT(err?.message === "share_active" ? "apps.awsControl.console.move_shared" : err?.status === 409 ? "apps.awsControl.console.move_conflict" : "apps.awsControl.console.move_failed"),
				error: e
			});
		}
	});
	/** ONE move at a time. While a copy runs, the other rows' "Move to
	*  folder…" items are disabled, rows are not draggable, and a drop is
	*  ignored — so there is never a second in-flight move whose busy marker,
	*  refusal, or completion could be confused with the first one's. The
	*  original ask was a visible busy state for the move in flight, not
	*  concurrent moves. */
	const moveBusy = moveMut.isPending;
	/** The source key of the move in flight, or null. Exact, because at most
	*  one move runs at a time and `variables` is read only while pending. */
	const movingKey = moveBusy ? moveMut.variables?.fromKey ?? null : null;
	/** The wire format an internal file drag travels as. A custom MIME keeps OS
	*  file drops (types includes 'Files') and internal moves distinguishable. */
	const DRAG_MIME = "application/x-drive-object-key";
	const renameMut = useMutation({
		mutationFn: ({ fromKey, toKey }) => awsControlApi.driveMove(account, "drive", fromKey, toKey),
		onMutate: () => setPageError(null),
		onSuccess: (_data, { fromKey }) => {
			if (renamingRef.current === fromKey) {
				setRenaming(null);
				setRenameError("");
				returnFocusIfDropped();
			}
			qc.invalidateQueries({ queryKey: appKey(["drive-list", account]) });
			invalidate();
		},
		onError: (e, { fromKey }) => {
			const err = e instanceof AwsControlError ? e : null;
			const reason = i18nT(err?.message === "share_active" ? "apps.awsControl.console.rename_shared" : err?.status === 409 ? "apps.awsControl.console.rename_conflict" : "apps.awsControl.console.rename_failed");
			if (renamingRef.current === fromKey) {
				setRenameError(reason);
				return;
			}
			setPageError({
				message: i18nT("apps.awsControl.console.rename_failed_named", {
					name: fromKey.split("/").pop() ?? fromKey,
					reason
				}),
				error: e
			});
		}
	});
	const openRename = (key) => {
		menuLayer.openLayer(() => {
			setRenaming(key);
			setRenameValue(key.split("/").pop() ?? key);
			setRenameError("");
		});
	};
	const closeRename = () => {
		if (renameMut.isPending && renameMut.variables?.fromKey === renaming) return;
		setRenaming(null);
		setRenameError("");
		returnFocusIfDropped();
		if (!renameMut.isPending) renameMut.reset();
	};
	useEffect(() => {
		renamingRef.current = null;
		confirmDeleteRef.current = null;
		setRenaming(null);
		setRenameError("");
		setConfirmDelete(null);
		if (debouncedQuery) setHighlightKey(null);
	}, [debouncedQuery]);
	const commitRename = (fromKey) => {
		const name = renameValue;
		if (!name.trim()) return;
		if (name === (fromKey.split("/").pop() ?? fromKey)) {
			closeRename();
			return;
		}
		if (!KEY_SEGMENT.test(name)) {
			setRenameError(i18nT("apps.awsControl.console.rename_bad_name"));
			return;
		}
		const dir = fromKey.split("/").slice(0, -1).join("/");
		setRenameError("");
		renameMut.mutate({
			fromKey,
			toKey: dir ? `${dir}/${name}` : name
		});
	};
	const searching = debouncedQuery.length > 0;
	const searchQ = useAppQuery([
		"drive-search",
		account,
		debouncedQuery
	], {
		queryFn: () => awsControlApi.driveSearch(account, "drive", debouncedQuery),
		enabled: searching,
		placeholderData: keepPreviousData
	});
	/** The key of the drag THIS component started, or null. The drop handler
	*  trusts this ref, never the DataTransfer payload: drag data is
	*  attacker-writable (any external page can start a drag carrying our MIME
	*  with a real key), and a drop on a folder here would then run an
	*  authenticated move of the owner's file. The payload is still written for
	*  the OS drag image / other targets, but a drop only moves what our own
	*  onDragStart recorded — cleared on dragend so a stale key can never
	*  outlive its gesture. */
	const dragKeyRef = useRef(null);
	/** Move `fromKey` into `folder` (full path, '' = section root). A drop onto
	*  the folder the file already lives in is a no-op, not an error; so is a
	*  drop while another move is still running (rows are not draggable then,
	*  but a drag that began before the gate closed can still land). */
	const moveInto = (fromKey, folder) => {
		if (moveBusy) return;
		const base = fromKey.split("/").pop() ?? fromKey;
		if (fromKey.split("/").slice(0, -1).join("/") === folder) return;
		setMoveError(null);
		moveMut.mutate({
			fromKey,
			toKey: folder ? `${folder}/${base}` : base
		});
	};
	/** Shared drop-target wiring: accepts OS files (upload into `folder`) and
	*  internal drags (move into `folder`). */
	const dropProps = (folder) => ({
		onDragOver: (e) => {
			const t = e.dataTransfer.types;
			if (!t.includes("Files") && !t.includes(DRAG_MIME)) return;
			e.preventDefault();
			e.stopPropagation();
			setDropTarget(folder);
		},
		onDragLeave: (e) => {
			e.stopPropagation();
			setDropTarget((cur) => cur === folder ? null : cur);
		},
		onDrop: (e) => {
			e.preventDefault();
			e.stopPropagation();
			setDropTarget(null);
			const key = dragKeyRef.current;
			dragKeyRef.current = null;
			if (key && e.dataTransfer.types.includes(DRAG_MIME)) moveInto(key, folder);
			else if (e.dataTransfer.files.length > 0) uploadDropped(e.dataTransfer.files, folder);
		}
	});
	/** What the section carries while a search is active: the drop is swallowed
	*  (preventDefault, so the browser never navigates to a dropped file) and
	*  nothing is uploaded, because the folder it would land in is off-screen.
	*  The drag-over highlight stays off too -- a highlighted target that does
	*  nothing on release would read as a failed upload. */
	const inertDropProps = {
		onDragOver: (e) => {
			e.preventDefault();
			e.stopPropagation();
		},
		onDrop: (e) => {
			e.preventDefault();
			e.stopPropagation();
			dragKeyRef.current = null;
		}
	};
	/** Draggable wiring for a file row/tile. Not draggable while a move runs:
	*  one move at a time. */
	const dragProps = (key) => ({
		draggable: !moveBusy,
		onDragStart: (e) => {
			dragKeyRef.current = key;
			e.dataTransfer.setData(DRAG_MIME, key);
			e.dataTransfer.effectAllowed = "move";
		},
		onDragEnd: () => {
			dragKeyRef.current = null;
		}
	});
	const download = async (key) => {
		setDownloadError(null);
		const tab = window.open("", "_blank");
		if (tab) tab.opener = null;
		try {
			const { url } = await awsControlApi.driveDownload(account, "drive", key);
			if (tab) tab.location.href = url;
			else window.open(url, "_blank", "noopener");
		} catch (e) {
			tab?.close();
			setDownloadError({
				message: i18nT("apps.awsControl.console.download_failed"),
				error: e,
				key
			});
		}
	};
	return {
		mode,
		setMode,
		path,
		setPath,
		share,
		setShare,
		uploadError,
		downloadError,
		preview,
		setPreview,
		renaming,
		renameValue,
		setRenameValue,
		renameError,
		query,
		setQuery,
		debouncedQuery,
		setHighlightKey,
		highlighted,
		highlightProps,
		confirmDelete,
		setConfirmDelete,
		confirmFolder,
		setConfirmFolder,
		newFolder,
		setNewFolder,
		creatingFolder,
		setCreatingFolder,
		folderError,
		folderToggleRef,
		folderNameRef,
		moveTarget,
		rememberMenuOpener,
		skipRestoreIfDialog,
		openShare,
		openMove,
		returnFocusToOpener,
		moveDialogOpenRef,
		closeMoveDialog,
		moveToNewFolder,
		closeFolderDisclosure,
		handOff,
		deletedHere,
		fileRef,
		attachScroller,
		edges,
		listQ,
		folders,
		files,
		uploadMut,
		deleteMut,
		openConfirmDelete,
		deleteFailedFor,
		folderCreateMut,
		folderDeleteMut,
		onCreateFolder,
		onPick,
		dropTarget,
		moveError,
		setMoveError,
		pageError,
		moveMut,
		moveBusy,
		movingKey,
		renameMut,
		openRename,
		closeRename,
		commitRename,
		searching,
		searchQ,
		dropProps,
		inertDropProps,
		dragProps,
		download,
		crumbs: path.split("/").filter(Boolean)
	};
}
// src/host/LibraryTable.tsx
/**
* The table head the drive's file tables share with the dashboard's artifact
* library, restated from its `components/library/LibraryTable.tsx` (not on the App
* SDK) with the same markup: translated column labels, and an Actions column pinned
* `sticky right-0` on an opaque fill of the surface the table sits on, with the
* seam drawn only when the table overflows. The drive's columns never sort, so the
* sortable header cell is not carried.
*/
/** The opaque fill + `right-full` gradient pair for a pinned cell on a surface. */
var PINNED_SURFACE = {
	card: {
		fill: "bg-card",
		seam: "from-card"
	},
	bg: {
		fill: "bg-bg",
		seam: "from-bg"
	}
};
function LibraryTableHead({ edgeRight = false, columns, actionsLabelKey, surface = "card" }) {
	const pinned = PINNED_SURFACE[surface];
	const th = "text-left text-muted text-[12px] uppercase tracking-[.04em] px-2.5 py-2 border-b border-border font-medium";
	return /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [columns.map((c, i) => /* @__PURE__ */ jsx("th", {
		className: `${th} ${c.className ?? ""}`,
		"aria-label": c.ariaLabel ? i18nT(c.ariaLabel) : void 0,
		children: c.label ? i18nT(c.label) : null
	}, `c${i}`)), /* @__PURE__ */ jsxs("th", {
		className: `${th} w-[120px] sticky right-0 ${pinned.fill}`,
		children: [
			edgeRight && /* @__PURE__ */ jsx("div", {
				"aria-hidden": "true",
				className: "pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-border"
			}),
			edgeRight && /* @__PURE__ */ jsx("div", {
				"aria-hidden": "true",
				className: `pointer-events-none absolute right-full top-0 bottom-0 w-6 bg-gradient-to-l ${pinned.seam} to-transparent`
			}),
			i18nT(actionsLabelKey)
		]
	})] }) });
}
// src/DrivePageFilesViews.tsx
/**
* AWS Control drive - the three ways the Files pane draws objects: search hits
* from the whole section, and the open folder as a grid of tiles or as a table.
*
* Each view reads the pane's state object (`DriveFilesPane`, from
* `useDrivePageFiles.ts`). The grid and the table carry the same per-item actions:
* a view mode is a way of looking at the folder, not a capability tier. A search
* hit carries a file's Download, Rename, Share and Delete, plus Open containing
* folder.
*/
/**
* The drive's columns.
*
* An S3 object has no slug, source, version or tags, so the artifact library's
* nine columns cannot be reused as they are - these four plus the pinned Actions
* cell are what a stored object actually has. None is sortable (see the head
* call), which is why every `key` is empty.
*/
var DRIVE_COLUMNS = [
	{
		key: "",
		label: "apps.awsControl.console.col_name",
		className: "min-w-[200px]"
	},
	{
		key: "",
		label: "apps.awsControl.console.col_kind",
		className: "w-[110px]"
	},
	{
		key: "",
		label: "apps.awsControl.console.col_size",
		className: "w-[90px]"
	},
	{
		key: "",
		label: "apps.awsControl.console.col_modified",
		className: "w-[120px]"
	}
];
/** Search hits carry no Kind column: the full relative key already names the
*  extension, and the header's job here is to keep the result rows on the same
*  grid the folder listing uses so a search does not read as a different page. */
var SEARCH_COLUMNS = [
	{
		key: "",
		label: "apps.awsControl.console.col_name",
		className: "min-w-[200px]"
	},
	{
		key: "",
		label: "apps.awsControl.console.col_size",
		className: "w-[90px]"
	},
	{
		key: "",
		label: "apps.awsControl.console.col_modified",
		className: "w-[120px]"
	}
];
/**
* The Kind cell for a stored object: its extension, upper-cased.
*
* NOT the shared `docFileType`, which answers only 'markdown' or 'text' because
* it classifies session DOCUMENTS - it labelled a .pdf and an .mp4 'markdown'.
* An S3 object can be anything, and the extension is the only kind information
* `ListObjectsV2` actually returns, so it is what the column shows. A key with
* no extension gets a dash rather than an invented category.
*/
/**
* The "Move to folder…" item's label. Moves run one at a time, so while one is
* in flight every row's item is disabled; the reason is written into the item
* itself. A tooltip would not do: a disabled Radix item takes no pointer
* events, so its `title` never shows, and a keyboard reader never hovers.
*/
function MoveToLabel({ busy }) {
	if (!busy) return /* @__PURE__ */ jsx(Fragment$1, { children: i18nT("apps.awsControl.console.move_to") });
	return /* @__PURE__ */ jsxs("span", {
		className: "flex flex-col gap-0.5",
		children: [/* @__PURE__ */ jsx("span", { children: i18nT("apps.awsControl.console.move_to") }), /* @__PURE__ */ jsx("span", {
			className: "text-[11px] text-muted leading-snug",
			"data-testid": "move-to-busy",
			children: i18nT("apps.awsControl.console.move_to_busy")
		})]
	});
}
function objectKind(key) {
	const name = key.split("/").pop() ?? key;
	const dot = name.lastIndexOf(".");
	if (dot <= 0 || dot === name.length - 1) return "-";
	return name.slice(dot + 1).toUpperCase();
}
/**
* Did this event start inside a control NESTED in the clickable card?
*
* A card that is itself a control but also holds buttons (an overflow trigger, a
* confirm's Cancel and Delete) sees their events bubble up. Acting on them opens
* the folder the reader was trying to act WITHIN, and on the keyboard path the
* card's own `preventDefault` would additionally cancel the nested control's
* activation -- so the menu and the confirm would stop answering the keyboard at
* all. `role="button"` is deliberately NOT in the selector: that is what the card
* itself carries, and matching it would make every event look nested.
*/
function fromNestedControl(e) {
	const target = e.target;
	if (!target || target === e.currentTarget) return false;
	return !!target.closest("button, a, input, select, textarea, [role=\"menuitem\"]");
}
/** No column is sortable, so the shared head never calls this. */
var noSort = () => {};
/** Search hits from the whole section, as a table: each hit carries Download, Rename, Share, Open containing folder and Delete. */
function DriveFilesSearchResults({ pane }) {
	const { setPath, setPreview, renaming, renameValue, setRenameValue, renameError, setQuery, debouncedQuery, setHighlightKey, confirmDelete, setConfirmDelete, rememberMenuOpener, skipRestoreIfDialog, openShare, handOff, deleteMut, openConfirmDelete, deleteFailedFor, renameMut, openRename, closeRename, commitRename, searchQ, download } = pane;
	return /* @__PURE__ */ jsxs("div", {
		"data-testid": "drive-search-results",
		children: [
			searchQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 2 }),
			searchQ.isFetching && !searchQ.isLoading && /* @__PURE__ */ jsxs("p", {
				className: "mb-2 flex items-center gap-1.5 text-[11px] text-muted",
				"data-testid": "drive-search-pending",
				role: "status",
				children: [/* @__PURE__ */ jsx(RefreshCw, {
					size: 11,
					className: "animate-spin",
					"aria-hidden": "true"
				}), i18nT("apps.awsControl.console.search_pending")]
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				error: searchQ.error,
				message: searchQ.isError ? i18nT("apps.awsControl.console.search_failed") : null,
				askAgent: handOff,
				onRetry: () => searchQ.refetch(),
				className: "mb-2",
				testId: "drive-search-error"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: searchQ.isFetching && !searchQ.isLoading ? "opacity-60 transition-opacity" : void 0,
				"aria-busy": searchQ.isFetching && !searchQ.isLoading ? true : void 0,
				"data-testid": "drive-search-body",
				children: [
					searchQ.isSuccess && searchQ.data.results.length === 0 && /* @__PURE__ */ jsx(FilteredEmpty, {
						query: debouncedQuery,
						onClear: () => setQuery(""),
						noun: i18nT("apps.awsControl.console.section_files"),
						testId: "drive-search-empty"
					}),
					searchQ.isSuccess && searchQ.data.capped && /* @__PURE__ */ jsx("p", {
						className: "mb-2 text-[11px] text-muted",
						"data-testid": "drive-search-capped",
						children: i18nT("apps.awsControl.console.search_capped", { count: searchQ.data.limit })
					}),
					searchQ.isSuccess && searchQ.data.results.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "overflow-x-auto",
						"data-testid": "drive-search-table",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full border-collapse text-[13px]",
							children: [/* @__PURE__ */ jsx(LibraryTableHead, {
								sort: null,
								onSort: noSort,
								columns: SEARCH_COLUMNS,
								actionsLabelKey: "apps.awsControl.console.col_actions",
								surface: "bg"
							}), /* @__PURE__ */ jsx("tbody", { children: searchQ.data.results.map((hit) => /* @__PURE__ */ jsxs(Fragment, { children: [
								/* @__PURE__ */ jsxs("tr", {
									className: "border-b border-border last:border-0 hover:bg-bg-hover",
									"data-testid": "drive-search-hit",
									children: [
										/* @__PURE__ */ jsx("td", {
											className: "px-2.5 py-2",
											children: /* @__PURE__ */ jsxs("button", {
												type: "button",
												onClick: () => setPreview({
													key: hit.key,
													size: hit.size
												}),
												className: "flex min-w-0 max-w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left text-text hover:underline",
												title: hit.key,
												"data-testid": "drive-search-open",
												children: [/* @__PURE__ */ jsx(FileText, {
													size: 14,
													className: "shrink-0 text-muted",
													"aria-hidden": "true"
												}), /* @__PURE__ */ jsxs("span", {
													className: "flex min-w-0",
													children: [hit.key.includes("/") && /* @__PURE__ */ jsx("span", {
														className: "truncate text-muted",
														children: hit.key.slice(0, hit.key.lastIndexOf("/") + 1)
													}), /* @__PURE__ */ jsx("span", {
														className: "shrink-0",
														children: hit.key.slice(hit.key.lastIndexOf("/") + 1)
													})]
												})]
											})
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-2.5 py-2 text-muted",
											children: fmtBytes(hit.size)
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-2.5 py-2 text-muted",
											children: fmtRelative(hit.modified)
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-2.5 py-2",
											children: /* @__PURE__ */ jsx("div", {
												className: "flex items-center justify-end gap-1",
												children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
													asChild: true,
													children: /* @__PURE__ */ jsx(IconButton, {
														"aria-label": i18nT("apps.awsControl.console.file_actions"),
														onPointerDown: rememberMenuOpener,
														onKeyDown: rememberMenuOpener,
														"data-testid": "drive-search-more",
														children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
													})
												}), /* @__PURE__ */ jsxs(DropdownMenuContent, {
													align: "end",
													onCloseAutoFocus: skipRestoreIfDialog,
													children: [
														/* @__PURE__ */ jsxs(DropdownMenuItem, {
															onSelect: () => download(hit.key),
															"data-testid": "drive-search-download",
															children: [/* @__PURE__ */ jsx(Download, { size: 13 }), i18nT("apps.awsControl.console.download")]
														}),
														/* @__PURE__ */ jsxs(DropdownMenuItem, {
															onSelect: () => openRename(hit.key),
															"data-testid": "drive-search-rename",
															children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.rename")]
														}),
														/* @__PURE__ */ jsxs(DropdownMenuItem, {
															onSelect: () => openShare(hit.key),
															"data-testid": "drive-search-share",
															children: [/* @__PURE__ */ jsx(Share2, { size: 13 }), i18nT("apps.awsControl.console.share")]
														}),
														/* @__PURE__ */ jsxs(DropdownMenuItem, {
															onSelect: () => {
																setPath(hit.key.split("/").slice(0, -1).join("/"));
																setHighlightKey(hit.key);
																setQuery("");
															},
															"data-testid": "drive-search-goto",
															children: [/* @__PURE__ */ jsx(FolderOpen, { size: 13 }), i18nT("apps.awsControl.console.search_goto")]
														}),
														/* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
														/* @__PURE__ */ jsxs(DropdownMenuItem, {
															onSelect: () => openConfirmDelete(hit.key),
															"data-testid": "drive-search-delete",
															children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.delete")]
														})
													]
												})] })
											})
										})
									]
								}),
								renaming === hit.key && /* @__PURE__ */ jsx("tr", {
									className: "border-b border-border bg-bg-elevated",
									"data-testid": "drive-rename-row",
									children: /* @__PURE__ */ jsx("td", {
										colSpan: SEARCH_COLUMNS.length + 1,
										className: "px-2.5 py-2",
										children: /* @__PURE__ */ jsxs("div", {
											className: "sticky left-0 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 pr-4",
											children: [
												/* @__PURE__ */ jsx(Input, {
													value: renameValue,
													onChange: (e) => setRenameValue(e.target.value),
													onKeyDown: (e) => {
														if (e.key === "Enter") commitRename(hit.key);
														if (e.key === "Escape") closeRename();
													},
													autoFocus: true,
													"aria-label": i18nT("apps.awsControl.console.rename"),
													className: "w-full min-w-0 sm:w-[260px]",
													"data-testid": "drive-rename-input"
												}),
												/* @__PURE__ */ jsx(AwsErrorNotice, {
													message: renameError,
													askAgent: false,
													variant: "inline",
													testId: "drive-rename-error"
												}),
												/* @__PURE__ */ jsx(Btn, {
													onClick: closeRename,
													disabled: renameMut.isPending,
													"data-testid": "drive-rename-cancel",
													children: i18nT("apps.awsControl.console.cancel")
												}),
												/* @__PURE__ */ jsxs(Btn, {
													primary: true,
													disabled: renameMut.isPending || !renameValue.trim(),
													onClick: () => commitRename(hit.key),
													"data-testid": "drive-rename-save",
													children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.rename")]
												})
											]
										})
									})
								}),
								confirmDelete === hit.key && /* @__PURE__ */ jsx("tr", {
									className: "border-b border-border bg-bg-elevated",
									"data-testid": "drive-delete-confirm",
									children: /* @__PURE__ */ jsx("td", {
										colSpan: SEARCH_COLUMNS.length + 1,
										className: "px-2.5 py-2",
										children: /* @__PURE__ */ jsxs("div", {
											className: "sticky left-0 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 pr-4",
											children: [
												/* @__PURE__ */ jsx("span", {
													className: "min-w-0 flex-1 text-text",
													children: i18nT("apps.awsControl.console.delete_confirm", { name: hit.key })
												}),
												/* @__PURE__ */ jsx(AwsErrorNotice, {
													askAgent: handOff,
													error: deleteFailedFor(hit.key) ? deleteMut.error : null,
													message: deleteFailedFor(hit.key) ? i18nT("apps.awsControl.console.delete_failed") : null,
													variant: "inline",
													className: "basis-full",
													testId: "drive-delete-error"
												}),
												/* @__PURE__ */ jsx(Btn, {
													onClick: () => setConfirmDelete(null),
													"data-testid": "drive-delete-cancel",
													children: i18nT("apps.awsControl.console.cancel")
												}),
												/* @__PURE__ */ jsxs(Btn, {
													danger: true,
													disabled: deleteMut.isPending,
													onClick: () => deleteMut.mutate(hit.key, { onSuccess: () => setConfirmDelete((cur) => cur === hit.key ? null : cur) }),
													"data-testid": "drive-delete-confirm-action",
													children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.delete_confirm_action")]
												})
											]
										})
									})
								})
							] }, hit.key)) })]
						})
					})
				]
			})
		]
	});
}
/** The open folder as a grid of tiles: folders first, then files. */
function DriveFilesGrid({ pane }) {
	const { setPath, setPreview, renaming, renameValue, setRenameValue, renameError, highlighted, highlightProps, confirmDelete, setConfirmDelete, confirmFolder, setConfirmFolder, rememberMenuOpener, skipRestoreIfDialog, openShare, openMove, handOff, folders, files, deleteMut, openConfirmDelete, deleteFailedFor, folderDeleteMut, dropTarget, moveBusy, movingKey, renameMut, openRename, closeRename, commitRename, dropProps, dragProps, download } = pane;
	return /* @__PURE__ */ jsx("div", {
		"data-testid": "drive-grid",
		children: /* @__PURE__ */ jsxs("div", {
			className: "grid items-start gap-3",
			style: { gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))" },
			children: [folders.map((name) => {
				const open = () => setPath(name);
				return /* @__PURE__ */ jsxs("div", {
					role: "button",
					tabIndex: 0,
					onClick: (e) => {
						if (fromNestedControl(e)) return;
						open();
					},
					onKeyDown: (e) => {
						if (e.key !== "Enter" && e.key !== " ") return;
						if (fromNestedControl(e)) return;
						e.preventDefault();
						open();
					},
					"aria-label": i18nT("apps.awsControl.console.folder_open", { name: name.split("/").pop() ?? name }),
					...dropProps(name),
					className: `flex cursor-pointer flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-border-strong hover:bg-bg-hover ${dropTarget === name ? "border-accent bg-bg-hover" : ""}`,
					"data-testid": "drive-grid-folder",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex w-full items-start justify-between gap-2",
							children: [/* @__PURE__ */ jsx("span", {
								className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-accent",
								children: /* @__PURE__ */ jsx(FolderClosed, {
									className: "h-4 w-4",
									"aria-hidden": "true"
								})
							}), /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
								asChild: true,
								children: /* @__PURE__ */ jsx(IconButton, {
									onClick: (e) => e.stopPropagation(),
									"aria-label": i18nT("apps.awsControl.console.folder_actions"),
									"data-testid": "drive-grid-folder-more",
									children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
								})
							}), /* @__PURE__ */ jsx(DropdownMenuContent, {
								align: "end",
								children: /* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => setConfirmFolder(name),
									"data-testid": "drive-grid-folder-delete",
									children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.folder_delete_action")]
								})
							})] })]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "w-full truncate text-[13px] font-medium text-text-strong",
							children: name.split("/").pop()
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-[12px] text-muted",
							children: i18nT("apps.awsControl.console.kind_folder")
						}),
						confirmFolder === name && /* @__PURE__ */ jsx(TileConfirm, {
							label: i18nT("apps.awsControl.console.folder_delete_confirm", { name: name.split("/").pop() ?? name }),
							error: folderDeleteMut.isError ? i18nT("apps.awsControl.console.folder_delete_failed") : "",
							errorSource: folderDeleteMut.error,
							askAgent: handOff,
							pending: folderDeleteMut.isPending,
							onCancel: () => setConfirmFolder(null),
							onConfirm: () => folderDeleteMut.mutate(name, { onSuccess: () => setConfirmFolder(null) }),
							action: i18nT("apps.awsControl.console.folder_delete_action")
						})
					]
				}, `gf-${name}`);
			}), files.map((f) => /* @__PURE__ */ jsxs("div", {
				...dragProps(f.key),
				...highlightProps(f.key),
				className: `flex flex-col items-start gap-2 rounded-lg border bg-card p-3 ${highlighted(f.key) ? "border-accent" : "border-border"} ${movingKey === f.key ? "opacity-50" : ""}`,
				"aria-busy": movingKey === f.key || void 0,
				"data-testid": "drive-grid-file",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex w-full items-start justify-between gap-2",
						children: [/* @__PURE__ */ jsx("span", {
							className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-muted",
							children: /* @__PURE__ */ jsx(FileText, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							})
						}), /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
							asChild: true,
							children: /* @__PURE__ */ jsx(IconButton, {
								"aria-label": i18nT("apps.awsControl.console.file_actions"),
								"data-testid": "drive-grid-more",
								onPointerDown: rememberMenuOpener,
								onKeyDown: rememberMenuOpener,
								children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
							})
						}), /* @__PURE__ */ jsxs(DropdownMenuContent, {
							align: "end",
							onCloseAutoFocus: skipRestoreIfDialog,
							children: [
								/* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => download(f.key),
									"data-testid": "drive-grid-download",
									children: [/* @__PURE__ */ jsx(Download, { size: 13 }), i18nT("apps.awsControl.console.download")]
								}),
								/* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => openRename(f.key),
									"data-testid": "drive-grid-rename",
									children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.rename")]
								}),
								/* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => openShare(f.key),
									"data-testid": "drive-grid-share",
									children: [/* @__PURE__ */ jsx(Share2, { size: 13 }), i18nT("apps.awsControl.console.share")]
								}),
								/* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => openMove(f.key),
									disabled: moveBusy,
									"data-testid": "drive-grid-move",
									children: [/* @__PURE__ */ jsx(FolderInput, { size: 13 }), /* @__PURE__ */ jsx(MoveToLabel, { busy: moveBusy })]
								}),
								/* @__PURE__ */ jsxs(DropdownMenuItem, {
									onSelect: () => openConfirmDelete(f.key),
									"data-testid": "drive-grid-delete",
									children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.delete")]
								})
							]
						})] })]
					}),
					renaming !== f.key && /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setPreview({
							key: f.key,
							size: f.size
						}),
						className: "w-full cursor-pointer truncate border-none bg-transparent p-0 text-left text-[13px] font-medium text-text-strong hover:underline",
						"data-testid": "drive-grid-preview-open",
						children: f.key.split("/").pop()
					}),
					/* @__PURE__ */ jsx("span", {
						className: "text-[12px] text-muted tabular-nums",
						children: movingKey === f.key ? /* @__PURE__ */ jsx("span", {
							"data-testid": "drive-moving",
							children: i18nT("apps.awsControl.console.move_moving")
						}) : `${fmtBytes(f.size)} · ${fmtRelative(f.modified)}`
					}),
					confirmDelete === f.key && /* @__PURE__ */ jsx(TileConfirm, {
						label: i18nT("apps.awsControl.console.delete_confirm", { name: f.key.split("/").pop() ?? f.key }),
						error: deleteFailedFor(f.key) ? i18nT("apps.awsControl.console.delete_failed") : "",
						errorSource: deleteFailedFor(f.key) ? deleteMut.error : null,
						askAgent: handOff,
						pending: deleteMut.isPending,
						onCancel: () => setConfirmDelete(null),
						onConfirm: () => deleteMut.mutate(f.key, { onSuccess: () => setConfirmDelete((cur) => cur === f.key ? null : cur) }),
						action: i18nT("apps.awsControl.console.delete_confirm_action")
					}),
					renaming === f.key && /* @__PURE__ */ jsxs("div", {
						className: "flex w-full flex-wrap items-center gap-2",
						"data-testid": "drive-grid-rename-row",
						children: [
							/* @__PURE__ */ jsx(Input, {
								value: renameValue,
								onChange: (e) => setRenameValue(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") commitRename(f.key);
									if (e.key === "Escape") closeRename();
								},
								autoFocus: true,
								"aria-label": i18nT("apps.awsControl.console.rename"),
								className: "w-full min-w-0",
								"data-testid": "drive-grid-rename-input"
							}),
							/* @__PURE__ */ jsx(AwsErrorNotice, {
								message: renameError,
								askAgent: false,
								variant: "inline",
								testId: "drive-grid-rename-error"
							}),
							/* @__PURE__ */ jsx(Btn, {
								onClick: closeRename,
								disabled: renameMut.isPending,
								"data-testid": "drive-grid-rename-cancel",
								children: i18nT("apps.awsControl.console.cancel")
							}),
							/* @__PURE__ */ jsxs(Btn, {
								primary: true,
								disabled: renameMut.isPending || !renameValue.trim(),
								onClick: () => commitRename(f.key),
								"data-testid": "drive-grid-rename-save",
								children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.rename")]
							})
						]
					})
				]
			}, `go-${f.key}`))]
		})
	});
}
/** The open folder as a table on the shared library head: folders first, then files. */
function DriveFilesTable({ pane }) {
	const { setPath, setPreview, renaming, renameValue, setRenameValue, renameError, highlighted, highlightProps, confirmDelete, setConfirmDelete, confirmFolder, setConfirmFolder, rememberMenuOpener, skipRestoreIfDialog, openShare, openMove, handOff, attachScroller, edges, folders, files, deleteMut, openConfirmDelete, deleteFailedFor, folderDeleteMut, dropTarget, moveBusy, movingKey, renameMut, openRename, closeRename, commitRename, dropProps, dragProps, download } = pane;
	return /* @__PURE__ */ jsx("div", {
		ref: attachScroller,
		className: "overflow-x-auto",
		"data-testid": "drive-listing",
		children: /* @__PURE__ */ jsxs("table", {
			className: "w-full border-collapse text-[13px]",
			children: [/* @__PURE__ */ jsx(LibraryTableHead, {
				sort: null,
				onSort: noSort,
				edgeRight: edges.right,
				columns: DRIVE_COLUMNS,
				actionsLabelKey: "apps.awsControl.console.col_actions",
				surface: "bg"
			}), /* @__PURE__ */ jsxs("tbody", { children: [folders.map((name) => /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("tr", {
				onClick: () => setPath(name),
				...dropProps(name),
				className: `cursor-pointer border-b border-border last:border-0 hover:bg-bg-hover ${dropTarget === name ? "bg-bg-hover ring-1 ring-inset ring-accent" : ""}`,
				"data-testid": "drive-folder",
				children: [
					/* @__PURE__ */ jsx("td", {
						className: "px-2.5 py-2",
						children: /* @__PURE__ */ jsxs("button", {
							onClick: (e) => {
								e.stopPropagation();
								setPath(name);
							},
							className: "flex min-w-0 items-center gap-2 text-left text-text cursor-pointer bg-transparent border-none p-0",
							"data-testid": "drive-folder-open",
							children: [/* @__PURE__ */ jsx(FolderClosed, {
								size: 14,
								className: "shrink-0 text-muted"
							}), /* @__PURE__ */ jsx("span", {
								className: "truncate",
								children: name.split("/").pop()
							})]
						})
					}),
					/* @__PURE__ */ jsx("td", {
						className: "px-2.5 py-2 text-muted",
						children: i18nT("apps.awsControl.console.kind_folder")
					}),
					/* @__PURE__ */ jsx("td", {
						className: "px-2.5 py-2 text-muted",
						children: "-"
					}),
					/* @__PURE__ */ jsx("td", {
						className: "px-2.5 py-2 text-muted",
						children: "-"
					}),
					/* @__PURE__ */ jsxs("td", {
						className: `sticky right-0 ${PINNED_SURFACE.bg.fill} px-2.5 py-2`,
						children: [
							edges.right && /* @__PURE__ */ jsx("div", {
								"aria-hidden": "true",
								className: "pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-border"
							}),
							edges.right && /* @__PURE__ */ jsx("div", {
								"aria-hidden": "true",
								className: `pointer-events-none absolute right-full top-0 bottom-0 w-6 bg-gradient-to-l ${PINNED_SURFACE.bg.seam} to-transparent`
							}),
							/* @__PURE__ */ jsx("div", {
								className: "flex items-center justify-end",
								children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
									asChild: true,
									children: /* @__PURE__ */ jsx(IconButton, {
										onClick: (e) => e.stopPropagation(),
										"aria-label": i18nT("apps.awsControl.console.folder_actions"),
										"data-testid": "drive-folder-more",
										children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
									})
								}), /* @__PURE__ */ jsx(DropdownMenuContent, {
									align: "end",
									onClick: (e) => e.stopPropagation(),
									children: /* @__PURE__ */ jsxs(DropdownMenuItem, {
										onSelect: () => setConfirmFolder(name),
										"data-testid": "drive-folder-delete",
										children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.folder_delete_action")]
									})
								})] })
							})
						]
					})
				]
			}), confirmFolder === name && /* @__PURE__ */ jsx("tr", {
				className: "border-b border-border bg-bg-elevated",
				"data-testid": "drive-folder-delete-confirm",
				children: /* @__PURE__ */ jsx("td", {
					colSpan: 5,
					className: "px-2.5 py-2",
					children: /* @__PURE__ */ jsxs("div", {
						className: "sticky left-0 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 pr-4",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "min-w-0 flex-1 text-text",
								children: i18nT("apps.awsControl.console.folder_delete_confirm", { name: name.split("/").pop() ?? name })
							}),
							/* @__PURE__ */ jsx(AwsErrorNotice, {
								askAgent: handOff,
								error: folderDeleteMut.error,
								message: folderDeleteMut.isError ? i18nT("apps.awsControl.console.folder_delete_failed") : null,
								variant: "inline",
								className: "basis-full",
								testId: "drive-folder-delete-error"
							}),
							/* @__PURE__ */ jsx(Btn, {
								onClick: () => setConfirmFolder(null),
								"data-testid": "drive-folder-delete-cancel",
								children: i18nT("apps.awsControl.console.cancel")
							}),
							/* @__PURE__ */ jsxs(Btn, {
								danger: true,
								disabled: folderDeleteMut.isPending,
								onClick: () => folderDeleteMut.mutate(name, { onSuccess: () => setConfirmFolder(null) }),
								"data-testid": "drive-folder-delete-action",
								children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.folder_delete_action")]
							})
						]
					})
				})
			})] }, `f-${name}`)), files.map((f) => /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("tr", {
					...dragProps(f.key),
					...highlightProps(f.key),
					className: `border-b border-border last:border-0 hover:bg-bg-hover ${highlighted(f.key) ? "ring-2 ring-inset ring-accent" : ""} ${movingKey === f.key ? "opacity-50" : ""}`,
					"aria-busy": movingKey === f.key || void 0,
					"data-testid": "drive-file",
					children: [
						/* @__PURE__ */ jsx("td", {
							className: "px-2.5 py-2",
							children: /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => setPreview({
									key: f.key,
									size: f.size
								}),
								className: "flex min-w-0 max-w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left",
								"data-testid": "drive-preview-open",
								children: [/* @__PURE__ */ jsx(FileText, {
									size: 14,
									className: "shrink-0 text-muted",
									"aria-hidden": "true"
								}), /* @__PURE__ */ jsx("span", {
									className: "truncate text-text hover:underline",
									children: f.key.split("/").pop()
								})]
							})
						}),
						/* @__PURE__ */ jsx("td", {
							className: "px-2.5 py-2 text-muted",
							children: objectKind(f.key)
						}),
						/* @__PURE__ */ jsx("td", {
							className: "px-2.5 py-2 text-muted",
							children: fmtBytes(f.size)
						}),
						/* @__PURE__ */ jsx("td", {
							className: "px-2.5 py-2 text-muted",
							children: movingKey === f.key ? /* @__PURE__ */ jsx("span", {
								"data-testid": "drive-moving",
								children: i18nT("apps.awsControl.console.move_moving")
							}) : fmtRelative(f.modified)
						}),
						/* @__PURE__ */ jsxs("td", {
							className: `sticky right-0 ${PINNED_SURFACE.bg.fill} px-2.5 py-2`,
							children: [
								edges.right && /* @__PURE__ */ jsx("div", {
									"aria-hidden": "true",
									className: "pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-border"
								}),
								edges.right && /* @__PURE__ */ jsx("div", {
									"aria-hidden": "true",
									className: `pointer-events-none absolute right-full top-0 bottom-0 w-6 bg-gradient-to-l ${PINNED_SURFACE.bg.seam} to-transparent`
								}),
								/* @__PURE__ */ jsx("div", {
									className: "flex items-center justify-end gap-1",
									children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
										asChild: true,
										children: /* @__PURE__ */ jsx(IconButton, {
											"aria-label": i18nT("apps.awsControl.console.file_actions"),
											"data-testid": "drive-more",
											onPointerDown: rememberMenuOpener,
											onKeyDown: rememberMenuOpener,
											children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
										})
									}), /* @__PURE__ */ jsxs(DropdownMenuContent, {
										align: "end",
										onCloseAutoFocus: skipRestoreIfDialog,
										children: [
											/* @__PURE__ */ jsxs(DropdownMenuItem, {
												onSelect: () => download(f.key),
												"data-testid": "drive-download",
												children: [/* @__PURE__ */ jsx(Download, { size: 13 }), i18nT("apps.awsControl.console.download")]
											}),
											/* @__PURE__ */ jsxs(DropdownMenuItem, {
												onSelect: () => openRename(f.key),
												"data-testid": "drive-rename",
												children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.rename")]
											}),
											/* @__PURE__ */ jsxs(DropdownMenuItem, {
												onSelect: () => openShare(f.key),
												"data-testid": "drive-share",
												children: [/* @__PURE__ */ jsx(Share2, { size: 13 }), i18nT("apps.awsControl.console.share")]
											}),
											/* @__PURE__ */ jsxs(DropdownMenuItem, {
												onSelect: () => openMove(f.key),
												disabled: moveBusy,
												"data-testid": "drive-move",
												children: [/* @__PURE__ */ jsx(FolderInput, { size: 13 }), /* @__PURE__ */ jsx(MoveToLabel, { busy: moveBusy })]
											}),
											/* @__PURE__ */ jsxs(DropdownMenuItem, {
												onSelect: () => openConfirmDelete(f.key),
												"data-testid": "drive-delete",
												children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.delete")]
											})
										]
									})] })
								})
							]
						})
					]
				}),
				renaming === f.key && /* @__PURE__ */ jsx("tr", {
					className: "border-b border-border bg-bg-elevated",
					"data-testid": "drive-rename-row",
					children: /* @__PURE__ */ jsx("td", {
						colSpan: 5,
						className: "px-2.5 py-2",
						children: /* @__PURE__ */ jsxs("div", {
							className: "sticky left-0 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 pr-4",
							children: [
								/* @__PURE__ */ jsx(Input, {
									value: renameValue,
									onChange: (e) => setRenameValue(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter") commitRename(f.key);
										if (e.key === "Escape") closeRename();
									},
									autoFocus: true,
									"aria-label": i18nT("apps.awsControl.console.rename"),
									className: "w-full min-w-0 sm:w-[260px]",
									"data-testid": "drive-rename-input"
								}),
								/* @__PURE__ */ jsx(AwsErrorNotice, {
									message: renameError,
									askAgent: false,
									variant: "inline",
									testId: "drive-rename-error"
								}),
								/* @__PURE__ */ jsx(Btn, {
									onClick: closeRename,
									disabled: renameMut.isPending,
									"data-testid": "drive-rename-cancel",
									children: i18nT("apps.awsControl.console.cancel")
								}),
								/* @__PURE__ */ jsxs(Btn, {
									primary: true,
									disabled: renameMut.isPending || !renameValue.trim(),
									onClick: () => commitRename(f.key),
									"data-testid": "drive-rename-save",
									children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.rename")]
								})
							]
						})
					})
				}),
				confirmDelete === f.key && /* @__PURE__ */ jsx("tr", {
					className: "border-b border-border bg-bg-elevated",
					"data-testid": "drive-delete-confirm",
					children: /* @__PURE__ */ jsx("td", {
						colSpan: 5,
						className: "px-2.5 py-2",
						children: /* @__PURE__ */ jsxs("div", {
							className: "sticky left-0 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 pr-4",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "min-w-0 flex-1 text-text",
									children: i18nT("apps.awsControl.console.delete_confirm", { name: f.key.split("/").pop() ?? f.key })
								}),
								/* @__PURE__ */ jsx(AwsErrorNotice, {
									askAgent: handOff,
									error: deleteFailedFor(f.key) ? deleteMut.error : null,
									message: deleteFailedFor(f.key) ? i18nT("apps.awsControl.console.delete_failed") : null,
									variant: "inline",
									className: "basis-full",
									testId: "drive-delete-error"
								}),
								/* @__PURE__ */ jsx(Btn, {
									onClick: () => setConfirmDelete(null),
									"data-testid": "drive-delete-cancel",
									children: i18nT("apps.awsControl.console.cancel")
								}),
								/* @__PURE__ */ jsxs(Btn, {
									danger: true,
									disabled: deleteMut.isPending,
									onClick: () => deleteMut.mutate(f.key, { onSuccess: () => setConfirmDelete((cur) => cur === f.key ? null : cur) }),
									"data-testid": "drive-delete-confirm-action",
									children: [/* @__PURE__ */ jsx(Trash2, { size: 13 }), i18nT("apps.awsControl.console.delete_confirm_action")]
								})
							]
						})
					})
				})
			] }, `o-${f.key}`))] })]
		})
	});
}
// src/host/FileRenderers.ts
/**
* `detectFileType`: the viewer a drive object's name asks for, with the same
* extension tables as the dashboard's `components/FileRenderers.tsx`.
*/
var IMG_EXTS = /* @__PURE__ */ new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".webp",
	".avif",
	".svg",
	".ico"
]);
var CSV_EXTS = /* @__PURE__ */ new Set([".csv", ".tsv"]);
var JSON_EXTS = /* @__PURE__ */ new Set([".json"]);
var JSONL_EXTS = /* @__PURE__ */ new Set([".jsonl"]);
var HTML_EXTS = /* @__PURE__ */ new Set([".html", ".htm"]);
var PDF_EXTS = /* @__PURE__ */ new Set([".pdf"]);
var EXCALIDRAW_EXTS = /* @__PURE__ */ new Set([".excalidraw"]);
var VIDEO_EXTS = /* @__PURE__ */ new Set([
	".mp4",
	".m4v",
	".webm",
	".mov",
	".mkv",
	".ogv"
]);
var AUDIO_EXTS = /* @__PURE__ */ new Set([
	".mp3",
	".wav",
	".m4a",
	".flac",
	".ogg",
	".oga",
	".opus"
]);
var SHEET_EXTS = /* @__PURE__ */ new Set([".xlsx", ".xlsm"]);
var OFFICE_EXTS = /* @__PURE__ */ new Set([
	".docx",
	".doc",
	".xls",
	".pptx",
	".ppt",
	".odt",
	".ods",
	".odp"
]);
function extOf$1(fp) {
	const i = fp.lastIndexOf(".");
	return i >= 0 ? fp.slice(i).toLowerCase() : "";
}
function detectFileType(filePath) {
	const ext = extOf$1(filePath);
	if (IMG_EXTS.has(ext)) return "image";
	if (CSV_EXTS.has(ext)) return "csv";
	if (JSON_EXTS.has(ext)) return "json";
	if (JSONL_EXTS.has(ext)) return "jsonl";
	if (HTML_EXTS.has(ext)) return "html";
	if (PDF_EXTS.has(ext)) return "pdf";
	if (EXCALIDRAW_EXTS.has(ext)) return "excalidraw";
	if (VIDEO_EXTS.has(ext)) return "video";
	if (AUDIO_EXTS.has(ext)) return "audio";
	if (SHEET_EXTS.has(ext)) return "sheet";
	if (OFFICE_EXTS.has(ext)) return "office";
	if ([
		".md",
		".markdown",
		".mdx",
		".txt",
		""
	].includes(ext)) return "markdown";
	return "code";
}
// src/host/ContentRenderer.tsx
/**
* The text-preview body: markdown and code through the host's own
* `MarkdownRenderer` (App SDK), JSON pretty-printed, CSV/TSV as a table, and
* every other text type as plain text.
*
* The built-in rendered through the dashboard's `ContentRenderer`, which also has
* a JSON tree, a JSONL stream, a sandboxed HTML page and an Excalidraw scene; none
* of those viewers is on the App SDK (PORTING.md, "File previews"). An HTML object
* is shown as its source here, never rendered, so a bucket object cannot run.
*/
var MD_EXTS = /* @__PURE__ */ new Set([
	".md",
	".markdown",
	".mdx",
	".txt",
	""
]);
function extOf(fp) {
	const i = fp.lastIndexOf(".");
	return i >= 0 ? fp.slice(i).toLowerCase() : "";
}
function wrapCode(content, ext) {
	return "~~~" + ext.replace(".", "") + "\n" + content + "\n~~~";
}
function langFor(ext) {
	return {
		".ts": "typescript",
		".tsx": "typescript",
		".js": "javascript",
		".jsx": "javascript",
		".py": "python",
		".json": "json",
		".yaml": "yaml",
		".yml": "yaml",
		".sh": "bash",
		".css": "css",
		".html": "html",
		".md": "markdown",
		".rs": "rust",
		".go": "go",
		".java": "java",
		".kt": "kotlin",
		".rb": "ruby",
		".sql": "sql",
		".xml": "xml",
		".toml": "ini",
		".cfg": "ini"
	}[ext] || "plaintext";
}
function prettyJson(content) {
	try {
		return JSON.stringify(JSON.parse(content), null, 2);
	} catch {
		return content;
	}
}
function splitRow(line, delimiter) {
	const cells = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (quoted) {
			if (ch === "\"" && line[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else if (ch === "\"") quoted = false;
			else cell += ch;
		} else if (ch === "\"") quoted = true;
		else if (ch === delimiter) {
			cells.push(cell);
			cell = "";
		} else cell += ch;
	}
	cells.push(cell);
	return cells;
}
function CsvTable({ content, delimiter }) {
	const [head, ...body] = content.split(/\r?\n/).filter((line) => line.length > 0).map((line) => splitRow(line, delimiter));
	return /* @__PURE__ */ jsx("div", {
		className: "overflow-auto",
		children: /* @__PURE__ */ jsxs("table", {
			className: "text-[12px] border-collapse",
			children: [head && /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: head.map((cell, i) => /* @__PURE__ */ jsx("th", {
				className: "border border-border px-2 py-1 text-left font-semibold text-text",
				children: cell
			}, i)) }) }), /* @__PURE__ */ jsx("tbody", { children: body.map((row, r) => /* @__PURE__ */ jsx("tr", { children: row.map((cell, i) => /* @__PURE__ */ jsx("td", {
				className: "border border-border px-2 py-1 text-text",
				children: cell
			}, i)) }, r)) })]
		})
	});
}
var ContentRenderer = memo(function ContentRenderer({ fileType, filePath, content, previewRef, displayContent, isMarkdown, markdownClassName, previewStyle }) {
	if (isMarkdown || fileType === "code" || fileType === "markdown") return /* @__PURE__ */ jsx("div", {
		ref: previewRef,
		className: markdownClassName,
		style: previewStyle,
		children: /* @__PURE__ */ jsx(MarkdownRenderer, { content: displayContent ?? content })
	});
	if (fileType === "csv") return /* @__PURE__ */ jsx(CsvTable, {
		content,
		delimiter: filePath && extOf(filePath) === ".tsv" ? "	" : ","
	});
	return /* @__PURE__ */ jsx("pre", {
		className: "h-full overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text",
		children: fileType === "json" ? prettyJson(content) : content
	});
});
// src/DrivePageFileDialogs.tsx
/**
* AWS Control drive - the dialogs the Files pane opens for one object: the
* in-place preview (`PreviewDialog`), the Move picker (`MoveDialog`) and the
* share-link dialog (`ShareDialog`). Each is a presentational scrim around a
* dialog panel, with modal keyboard behaviour from `useDialogFocusTrap`. The
* preview fetches its own presigned URL or text, and the share dialog mints the
* link.
*/
var EXPIRY_LABEL_KEY = {
	"1h": "apps.awsControl.console.expiry_1h",
	"1d": "apps.awsControl.console.expiry_1d",
	"7d": "apps.awsControl.console.expiry_7d"
};
var PREVIEW_TEXT = /* @__PURE__ */ new Set([
	".txt",
	".md",
	".markdown",
	".mdx",
	".csv",
	".tsv",
	".json",
	".jsonl",
	".log",
	".yaml",
	".yml",
	".xml",
	".html",
	".htm",
	".css",
	".js",
	".mjs",
	".cjs",
	".ts",
	".tsx",
	".jsx",
	".py",
	".sh",
	".toml",
	".ini",
	".cfg",
	".sql",
	".go",
	".rs",
	".java",
	".kt",
	".rb",
	".excalidraw"
]);
var WHOLE_DOC_TYPES = /* @__PURE__ */ new Set(["json", "excalidraw"]);
var NOOP = () => {};
function previewKind(key) {
	const type = detectFileType(key);
	if (type === "image" || type === "video" || type === "audio" || type === "pdf") return type;
	if (type === "sheet" || type === "office") return "none";
	return PREVIEW_TEXT.has(extOf(key)) ? "text" : "none";
}
/**
* The body of a text preview, rendered by the dashboard's own file renderers
* rather than by anything written for this pane.
*
* `ContentRenderer` is the same dispatcher the file side panel and the artifact
* detail page render through, so markdown, a csv table, a JSON tree, a jsonl
* stream, a sandboxed HTML page, an Excalidraw scene and syntax-highlighted
* code all look here exactly as they look there -- and a renderer added to the
* SDK later arrives here for free. What this pane still owns is the TRANSPORT:
* the bytes came from the gateway's preview endpoint, capped and redacted,
* which is what the two notices above this body are about.
*/
function PreviewBody({ fileKey, content, truncated }) {
	const bodyRef = useRef(null);
	const type = detectFileType(fileKey);
	const ext = extOf(fileKey);
	const isMarkdown = MD_EXTS.has(ext);
	if (truncated && WHOLE_DOC_TYPES.has(type)) return /* @__PURE__ */ jsx("pre", {
		className: "whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text",
		"data-testid": "drive-preview-text",
		children: content
	});
	const body = /* @__PURE__ */ jsx(ContentRenderer, {
		isRichType: !isMarkdown && type !== "code",
		fileType: type,
		content,
		editing: false,
		lang: langFor(ext),
		lineNums: true,
		wordWrap: true,
		onChange: NOOP,
		previewRef: bodyRef,
		filePath: type === "csv" ? fileKey : void 0,
		displayContent: isMarkdown ? content : wrapCode(content, ext),
		isMarkdown,
		markdownClassName: "msg-content text-sm leading-relaxed"
	});
	return isMarkdown ? /* @__PURE__ */ jsx("div", {
		"data-testid": "drive-preview-text",
		children: body
	}) : /* @__PURE__ */ jsx("div", {
		className: "h-[70vh]",
		"data-testid": "drive-preview-text",
		children: body
	});
}
/** In-place file preview. Same scrim/panel/focus-trap shape as
*  AddFromArtifactsDialog — no third dialog grammar. */
function PreviewDialog({ account, entry, onDownload, downloadError, onClose }) {
	const kind = previewKind(entry.key);
	const panelRef = useRef(null);
	const backdropDown = useRef(false);
	useDialogFocusTrap(panelRef, onClose);
	const [mediaError, setMediaError] = useState(false);
	const isMedia = kind === "image" || kind === "video" || kind === "audio" || kind === "pdf";
	const urlQ = useAppQuery([
		"drive-preview-url",
		account,
		entry.key
	], {
		queryFn: () => awsControlApi.driveDownload(account, "drive", entry.key),
		enabled: isMedia,
		gcTime: 0,
		staleTime: 0,
		retry: false
	});
	const remintPendingRef = useRef(false);
	const resumeAtRef = useRef(0);
	const onMediaError = (el) => {
		if (remintPendingRef.current) {
			setMediaError(true);
			return;
		}
		remintPendingRef.current = true;
		resumeAtRef.current = el?.currentTime ?? 0;
		urlQ.refetch();
	};
	const onMediaReady = (e) => {
		remintPendingRef.current = false;
		if (resumeAtRef.current > 0) {
			e.currentTarget.currentTime = resumeAtRef.current;
			resumeAtRef.current = 0;
		}
	};
	const textQ = useAppQuery([
		"drive-preview-text",
		account,
		entry.key
	], {
		queryFn: () => awsControlApi.drivePreview(account, "drive", entry.key),
		enabled: kind === "text",
		retry: false
	});
	const name = entry.key.split("/").pop() ?? entry.key;
	const dir = entry.key.includes("/") ? entry.key.slice(0, entry.key.lastIndexOf("/")) : "";
	const loading = kind === "text" ? textQ.isLoading : isMedia ? urlQ.isLoading : false;
	const failed = mediaError || (kind === "text" ? textQ.isError : isMedia ? urlQ.isError : false);
	const pdfNotRenderable = kind === "pdf" && typeof urlQ.data?.contentType === "string" && !urlQ.data.contentType.toLowerCase().startsWith("application/pdf");
	const unsupported = kind === "none" || pdfNotRenderable;
	const url = urlQ.data?.url;
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-safe-or-4 sm:p-safe-or-8",
		"data-testid": "drive-preview-dialog",
		role: "presentation",
		onMouseDown: (e) => {
			if (e.target === e.currentTarget) backdropDown.current = true;
		},
		onClick: (e) => {
			if (e.target === e.currentTarget && backdropDown.current) onClose();
			backdropDown.current = false;
		},
		children: /* @__PURE__ */ jsxs("div", {
			ref: panelRef,
			className: "flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": name,
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between gap-3 border-b border-border px-4 py-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex min-w-0 items-center gap-2",
					children: [
						/* @__PURE__ */ jsx(FileText, {
							size: 14,
							className: "shrink-0 text-muted",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsxs("h3", {
							className: "flex min-w-0 items-baseline gap-1.5 text-sm font-semibold text-text-strong",
							children: [/* @__PURE__ */ jsx("span", {
								className: "truncate",
								children: name
							}), dir && /* @__PURE__ */ jsxs("span", {
								className: "truncate text-[11px] font-normal text-muted",
								"data-testid": "drive-preview-dir",
								children: [dir, "/"]
							})]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "shrink-0 text-[11px] text-muted",
							children: fmtBytes(entry.size)
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex shrink-0 items-center gap-2",
					children: [/* @__PURE__ */ jsxs(Btn, {
						onClick: () => onDownload(entry.key),
						"data-testid": "drive-preview-download",
						children: [/* @__PURE__ */ jsx(Download, { size: 13 }), i18nT("apps.awsControl.console.download")]
					}), /* @__PURE__ */ jsx(IconButton, {
						onClick: onClose,
						"aria-label": i18nT("apps.awsControl.console.close"),
						"data-testid": "drive-preview-close",
						children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
					})]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "min-h-[160px] overflow-auto p-4",
				children: [
					/* @__PURE__ */ jsx(AwsErrorNotice, {
						error: downloadError?.error,
						message: downloadError?.message,
						askAgent: true,
						className: "mb-3",
						testId: "drive-preview-download-error"
					}),
					loading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 4 }),
					!loading && !failed && unsupported && /* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-muted",
						"data-testid": "drive-preview-fallback",
						children: i18nT("apps.awsControl.console.preview_unsupported")
					}),
					!loading && failed && /* @__PURE__ */ jsx(AwsErrorNotice, {
						error: kind === "text" ? textQ.error : urlQ.error,
						message: i18nT("apps.awsControl.console.preview_failed"),
						askAgent: true,
						onRetry: () => {
							setMediaError(false);
							remintPendingRef.current = false;
							kind === "text" ? textQ.refetch() : urlQ.refetch();
						},
						testId: "drive-preview-error"
					}),
					!loading && !failed && kind === "image" && url && /* @__PURE__ */ jsx("img", {
						src: url,
						alt: name,
						className: "mx-auto max-h-[70vh] max-w-full object-contain",
						onError: () => onMediaError(),
						"data-testid": "drive-preview-image"
					}),
					!loading && !failed && kind === "video" && url && /* @__PURE__ */ jsx("video", {
						src: url,
						controls: true,
						"aria-label": name,
						className: "mx-auto max-h-[70vh] max-w-full",
						onError: (e) => onMediaError(e.currentTarget),
						onLoadedMetadata: onMediaReady,
						"data-testid": "drive-preview-video"
					}),
					!loading && !failed && kind === "audio" && url && /* @__PURE__ */ jsx("audio", {
						src: url,
						controls: true,
						"aria-label": name,
						className: "w-full",
						onError: (e) => onMediaError(e.currentTarget),
						onLoadedMetadata: onMediaReady,
						"data-testid": "drive-preview-audio"
					}),
					!loading && !failed && kind === "pdf" && !pdfNotRenderable && url && /* @__PURE__ */ jsx("iframe", {
						src: url,
						title: name,
						sandbox: "",
						className: "h-[70vh] w-full rounded border border-border",
						"data-testid": "drive-preview-pdf"
					}),
					!loading && !failed && kind === "text" && textQ.data && /* @__PURE__ */ jsxs(Fragment$1, { children: [
						textQ.data.truncated && /* @__PURE__ */ jsx("p", {
							className: "mb-2 text-[11px] text-muted",
							"data-testid": "drive-preview-truncated",
							children: i18nT("apps.awsControl.console.preview_truncated")
						}),
						textQ.data.redacted && /* @__PURE__ */ jsx("p", {
							className: "mb-2 text-[12px] font-medium text-text",
							"data-testid": "drive-preview-redacted",
							children: i18nT("apps.awsControl.console.preview_redacted")
						}),
						/* @__PURE__ */ jsx(PreviewBody, {
							fileKey: entry.key,
							content: textQ.data.content,
							truncated: textQ.data.truncated
						})
					] })
				]
			})]
		})
	});
}
/**
* A folder picker for one file. Small on purpose: the destinations a reader
* can see from the current folder, one button each, no tree walk. Modal
* keyboard behaviour (focus in, Tab ring, Escape, focus restore) comes from the
* shared hook, exactly as `AddFromArtifactsDialog`, the Library picker.
*/
function MoveDialog({ fileKey, currentPath, folders, pending, error, askAgent, onMove, onClose, onNewFolder }) {
	const panelRef = useRef(null);
	useDialogFocusTrap(panelRef, onClose, { restoreFocus: false });
	const backdropDown = useRef(false);
	const name = fileKey.split("/").pop() ?? fileKey;
	const crumbs = currentPath.split("/").filter(Boolean);
	const parent = crumbs.length > 1 ? crumbs.slice(0, -1).join("/") : null;
	const options = [];
	if (currentPath) options.push({
		folder: "",
		label: i18nT("apps.awsControl.console.move_root"),
		testId: "move-root"
	});
	if (parent) options.push({
		folder: parent,
		label: i18nT("apps.awsControl.console.move_up", { name: crumbs[crumbs.length - 2] }),
		testId: "move-up"
	});
	for (const f of folders) options.push({
		folder: f,
		label: f.split("/").pop() ?? f,
		testId: "move-folder"
	});
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-safe-or-4",
		role: "presentation",
		onMouseDown: (e) => {
			if (e.target === e.currentTarget) backdropDown.current = true;
		},
		onClick: (e) => {
			if (e.target === e.currentTarget && backdropDown.current) onClose();
			backdropDown.current = false;
		},
		children: /* @__PURE__ */ jsxs("div", {
			ref: panelRef,
			className: "w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "aws-move-title",
			"aria-busy": pending || void 0,
			"data-testid": "move-dialog",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-3 flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsx("h3", {
						id: "aws-move-title",
						className: "min-w-0 truncate text-sm font-semibold text-text-strong",
						children: i18nT("apps.awsControl.console.move_title", { name })
					}), /* @__PURE__ */ jsx(IconButton, {
						onClick: onClose,
						"aria-label": i18nT("apps.awsControl.console.close"),
						"data-testid": "move-close",
						children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
					})]
				}),
				options.length === 0 ? /* @__PURE__ */ jsxs("div", {
					className: "flex flex-col items-start gap-2",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-muted",
						"data-testid": "move-no-folders",
						children: i18nT("apps.awsControl.console.move_no_folders")
					}), onNewFolder && /* @__PURE__ */ jsxs(Btn, {
						onClick: onNewFolder,
						"data-testid": "move-new-folder",
						children: [/* @__PURE__ */ jsx(FolderPlus, { size: 13 }), i18nT("apps.awsControl.console.folder_new")]
					})]
				}) : /* @__PURE__ */ jsx("div", {
					className: "flex max-h-72 flex-col gap-1 overflow-y-auto",
					"data-testid": "move-options",
					children: options.map((o) => /* @__PURE__ */ jsxs("button", {
						onClick: () => onMove(o.folder),
						disabled: pending,
						className: "flex w-full items-center gap-2 rounded-md border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-text cursor-pointer hover:bg-bg-hover focus-ring disabled:opacity-50",
						"data-testid": o.testId,
						"data-folder": o.folder,
						children: [/* @__PURE__ */ jsx(FolderClosed, {
							size: 14,
							className: "shrink-0 text-muted",
							"aria-hidden": "true"
						}), /* @__PURE__ */ jsx("span", {
							className: "min-w-0 truncate",
							children: o.label
						})]
					}, o.testId + o.folder))
				}),
				pending && /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-[12px] text-muted",
					"data-testid": "move-pending",
					children: i18nT("apps.awsControl.console.move_moving_picker")
				}),
				/* @__PURE__ */ jsx(AwsErrorNotice, {
					error: error?.error,
					message: error?.message,
					askAgent,
					askAgentLabel: i18nT("apps.awsControl.console.move_ask_agent"),
					actionPlacement: "below",
					className: "mt-2",
					testId: "move-error"
				})
			]
		})
	});
}
var EXPIRY_OPTIONS = [
	{
		key: "1h",
		secs: 3600
	},
	{
		key: "1d",
		secs: 86400
	},
	{
		key: "7d",
		secs: 604800
	}
];
function ShareDialog({ account, section, fileKey, onClose }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const [secs, setSecs] = useState(3600);
	const [note, setNote] = useState("");
	const shareMut = useMutation({
		mutationFn: () => awsControlApi.driveShare(account, section, fileKey, secs, note),
		onSuccess: () => qc.invalidateQueries({ queryKey: appKey(["shares", account]) })
	});
	const url = shareMut.data?.url;
	const panelRef = useRef(null);
	const backdropDown = useRef(false);
	const close = () => {
		if (!shareMut.isPending) onClose();
	};
	useDialogFocusTrap(panelRef, close, { restoreFocus: false });
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-safe-or-4",
		role: "presentation",
		onMouseDown: (e) => {
			if (e.target === e.currentTarget) backdropDown.current = true;
		},
		onClick: (e) => {
			if (e.target === e.currentTarget && backdropDown.current) close();
			backdropDown.current = false;
		},
		children: /* @__PURE__ */ jsxs("div", {
			ref: panelRef,
			className: "w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "aws-share-title",
			"data-testid": "share-dialog",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-3 flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("h3", {
					id: "aws-share-title",
					className: "min-w-0 truncate text-sm font-semibold text-text-strong",
					children: i18nT("apps.awsControl.console.share_title", { name: fileKey.split("/").pop() ?? fileKey })
				}), /* @__PURE__ */ jsx(IconButton, {
					onClick: close,
					disabled: shareMut.isPending,
					"aria-label": i18nT("apps.awsControl.console.close"),
					"data-testid": "share-close",
					children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
				})]
			}), !url ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
				/* @__PURE__ */ jsx("span", {
					className: "mb-1 block text-[12px] text-muted",
					children: i18nT("apps.awsControl.console.share_expiry")
				}),
				/* @__PURE__ */ jsx(RadioChipGroup, {
					className: "mb-3 flex gap-1.5",
					"data-testid": "share-expiry",
					ariaLabel: i18nT("apps.awsControl.console.share_expiry"),
					children: EXPIRY_OPTIONS.map((o) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setSecs(o.secs),
						...radioChip(secs === o.secs),
						className: `rounded-md border px-2.5 py-1 text-[13px] cursor-pointer transition-colors ${secs === o.secs ? "border-accent bg-accent/10 text-accent" : "border-border bg-transparent text-muted hover:text-text"}`,
						"data-testid": `share-expiry-${o.key}`,
						children: i18nT(EXPIRY_LABEL_KEY[o.key])
					}, o.key))
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "aws-share-note",
					className: "mb-1 block text-[12px] text-muted",
					children: i18nT("apps.awsControl.console.share_note")
				}),
				/* @__PURE__ */ jsx(Input, {
					id: "aws-share-note",
					value: note,
					onChange: (e) => setNote(e.target.value),
					placeholder: i18nT("apps.awsControl.console.share_note_placeholder"),
					className: "mb-3 w-full",
					"data-testid": "share-note"
				}),
				/* @__PURE__ */ jsx(AwsErrorNotice, {
					error: shareMut.error,
					message: shareMut.isError ? i18nT("apps.awsControl.console.share_failed") : null,
					askAgent: false,
					className: "mb-3",
					testId: "share-error"
				}),
				/* @__PURE__ */ jsx(Btn, {
					primary: true,
					onClick: () => shareMut.mutate(),
					disabled: shareMut.isPending,
					"data-testid": "share-create",
					children: shareMut.isPending ? i18nT("apps.awsControl.console.share_creating") : i18nT("apps.awsControl.console.share_create")
				})
			] }) : /* @__PURE__ */ jsxs("div", {
				"data-testid": "share-result",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-2 flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("code", {
							className: "flex-1 min-w-0 break-all rounded bg-bg px-2 py-1.5 font-mono text-[12px] text-text",
							children: url
						}), /* @__PURE__ */ jsx(CopyBtn, {
							text: url,
							testId: "share-copy"
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[12px] text-muted",
						children: i18nT("apps.awsControl.console.share_expires_note")
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 text-[12px] text-muted",
						children: i18nT("apps.awsControl.console.share_credentials_caveat")
					})
				]
			})]
		})
	});
}
// src/DrivePageFiles.tsx
/**
* AWS Control drive - the Files pane (the bucket's `drive/` prefix): its
* toolbar, notices, breadcrumb, empty state and dialogs, around whichever of the
* three views in `DrivePageFilesViews.tsx` is showing. Its state comes from
* `useDrivePageFiles` (`useDrivePageFiles.ts`). `DrivePage.tsx` re-exports
* `DriveSectionView`.
*/
function DriveSectionView({ account, bucket }) {
	const pane = useDrivePageFiles(account);
	const { mode, setMode, path, setPath, share, setShare, uploadError, downloadError, preview, setPreview, query, setQuery, newFolder, setNewFolder, creatingFolder, setCreatingFolder, folderError, folderToggleRef, folderNameRef, moveTarget, returnFocusToOpener, moveDialogOpenRef, closeMoveDialog, moveToNewFolder, closeFolderDisclosure, handOff, deletedHere, fileRef, listQ, folders, files, uploadMut, folderCreateMut, onCreateFolder, onPick, dropTarget, moveError, setMoveError, pageError, moveMut, moveBusy, searching, dropProps, inertDropProps, download, crumbs } = pane;
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "drive-section",
		...searching ? inertDropProps : dropProps(path),
		className: !searching && dropTarget === path ? "rounded-lg ring-1 ring-inset ring-accent" : void 0,
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(FolderClosed, { size: 18 }),
				title: i18nT("apps.awsControl.console.section_files"),
				actions: /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "relative w-full sm:w-[260px]",
							children: [/* @__PURE__ */ jsx(SearchInput, {
								value: query,
								onChange: (e) => setQuery(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Escape") setQuery("");
								},
								placeholder: i18nT("apps.awsControl.console.search_files"),
								"aria-label": i18nT("apps.awsControl.console.search_files"),
								className: "w-full [&>input]:pr-8",
								"data-testid": "drive-search-input"
							}), query && /* @__PURE__ */ jsx(IconButton, {
								onClick: () => setQuery(""),
								className: "absolute right-1.5 top-1/2 -translate-y-1/2",
								"aria-label": i18nT("apps.awsControl.console.search_clear"),
								"data-testid": "drive-search-clear",
								children: /* @__PURE__ */ jsx(X, { className: "h-3 w-3" })
							})]
						}),
						!searching && /* @__PURE__ */ jsx(ViewModeToggle, {
							section: "drive",
							mode,
							onChange: setMode
						}),
						searching ? null : creatingFolder ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
							/* @__PURE__ */ jsx(Input, {
								ref: folderNameRef,
								value: newFolder,
								onChange: (e) => setNewFolder(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") onCreateFolder();
									if (e.key === "Escape") closeFolderDisclosure();
								},
								onBlur: () => {
									if (!newFolder.trim()) closeFolderDisclosure();
								},
								autoFocus: true,
								placeholder: i18nT("apps.awsControl.console.folder_name"),
								"aria-label": i18nT("apps.awsControl.console.folder_new"),
								className: "w-full min-w-0 basis-full sm:w-[160px] sm:flex-none sm:basis-auto",
								"data-testid": "drive-folder-name"
							}),
							/* @__PURE__ */ jsxs(Btn, {
								onClick: onCreateFolder,
								disabled: folderCreateMut.isPending || !newFolder.trim(),
								"data-testid": "drive-folder-create",
								children: [/* @__PURE__ */ jsx(FolderPlus, { size: 13 }), i18nT("apps.awsControl.console.folder_new")]
							}),
							/* @__PURE__ */ jsx(Btn, {
								onClick: closeFolderDisclosure,
								disabled: folderCreateMut.isPending,
								"data-testid": "drive-folder-cancel",
								children: i18nT("apps.awsControl.console.cancel")
							})
						] }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs(Btn, {
							ref: folderToggleRef,
							onClick: () => setCreatingFolder(true),
							"data-testid": "drive-folder-toggle",
							children: [/* @__PURE__ */ jsx(FolderPlus, { size: 13 }), i18nT("apps.awsControl.console.folder_new")]
						}), /* @__PURE__ */ jsxs(Btn, {
							onClick: () => fileRef.current?.click(),
							disabled: uploadMut.isPending,
							"data-testid": "drive-upload-btn",
							children: [/* @__PURE__ */ jsx(Upload, { size: 13 }), uploadMut.isPending ? i18nT("apps.awsControl.console.drive_uploading") : i18nT("apps.awsControl.console.drive_upload")]
						})] })
					]
				})
			}),
			/* @__PURE__ */ jsx("input", {
				ref: fileRef,
				type: "file",
				className: "hidden",
				"aria-label": i18nT("apps.awsControl.console.drive_upload"),
				"data-testid": "drive-file-input",
				onChange: (e) => onPick(e.target.files?.[0])
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				error: uploadError?.error,
				message: uploadError?.message,
				askAgent: handOff && uploadError?.error !== void 0,
				className: "mb-2",
				testId: "drive-upload-error"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: handOff,
				error: moveTarget ? void 0 : moveError?.error,
				message: moveTarget ? null : moveError?.message,
				className: "mb-2",
				testId: "drive-move-error"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: handOff,
				error: pageError?.error,
				message: pageError?.message ?? null,
				className: "mb-2",
				testId: "drive-page-error"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				message: folderError,
				askAgent: false,
				className: "mb-2",
				testId: "drive-folder-error"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				error: folderCreateMut.error,
				message: folderCreateMut.isError ? i18nT("apps.awsControl.console.folder_create_failed") : null,
				askAgent: false,
				className: "mb-2",
				testId: "drive-folder-create-error"
			}),
			deletedHere && /* @__PURE__ */ jsx("p", {
				className: "mb-2 text-[12px] text-muted",
				"data-testid": "drive-folder-deleted",
				children: i18nT("apps.awsControl.console.folder_deleted", {
					count: deletedHere.count,
					name: deletedHere.name
				})
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: handOff,
				error: downloadError?.error,
				message: downloadError?.message,
				className: "mb-2",
				testId: "drive-download-error"
			}),
			!searching && crumbs.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "mb-2 flex flex-wrap items-center gap-1 text-[12px] text-muted",
				"data-testid": "drive-crumbs",
				children: [
					/* @__PURE__ */ jsx("button", {
						className: "hover:text-text cursor-pointer bg-transparent border-none p-0",
						onClick: () => setPath(""),
						children: i18nT("apps.awsControl.console.section_files")
					}),
					crumbs.length > 1 && /* @__PURE__ */ jsxs("span", {
						className: "flex items-center gap-1",
						children: [" / ", /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
							asChild: true,
							children: /* @__PURE__ */ jsx(IconButton, {
								"aria-label": i18nT("apps.awsControl.console.parent_folders"),
								"data-testid": "drive-crumb-more",
								children: /* @__PURE__ */ jsx(MoreHorizontal, { size: 14 })
							})
						}), /* @__PURE__ */ jsx(DropdownMenuContent, {
							align: "start",
							"data-testid": "drive-crumb-menu",
							children: crumbs.slice(0, -1).map((c, i) => /* @__PURE__ */ jsxs(DropdownMenuItem, {
								onSelect: () => setPath(crumbs.slice(0, i + 1).join("/")),
								children: [/* @__PURE__ */ jsx(FolderClosed, { size: 13 }), c]
							}, i))
						})] })]
					}),
					/* @__PURE__ */ jsxs("span", {
						"data-testid": "drive-crumb-current",
						children: [" / ", crumbs[crumbs.length - 1]]
					})
				]
			}),
			searching && /* @__PURE__ */ jsx(DriveFilesSearchResults, { pane }),
			!searching && listQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 2 }),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: handOff,
				error: listQ.error,
				message: listQ.isError ? i18nT("apps.awsControl.console.files_list_failed") : null,
				onRetry: () => listQ.refetch(),
				testId: "drive-list-error"
			}),
			!searching && listQ.isSuccess && folders.length === 0 && files.length === 0 && /* @__PURE__ */ jsx(EmptyState, {
				icon: /* @__PURE__ */ jsx(FolderClosed, {
					className: "h-10 w-10",
					"aria-hidden": "true"
				}),
				title: i18nT("apps.awsControl.console.files_empty_title"),
				subtitle: i18nT("apps.awsControl.console.files_empty_body"),
				testId: "drive-empty",
				action: /* @__PURE__ */ jsxs(Btn, {
					primary: true,
					onClick: () => fileRef.current?.click(),
					"data-testid": "drive-empty-upload",
					children: [/* @__PURE__ */ jsx(Upload, { size: 13 }), i18nT("apps.awsControl.console.drive_upload")]
				})
			}),
			!searching && mode === "grid" && (folders.length > 0 || files.length > 0) && /* @__PURE__ */ jsx(DriveFilesGrid, { pane }),
			!searching && mode === "list" && (folders.length > 0 || files.length > 0) && /* @__PURE__ */ jsx(DriveFilesTable, { pane }),
			!searching && listQ.hasNextPage && /* @__PURE__ */ jsx("div", {
				className: "mt-2",
				children: /* @__PURE__ */ jsx(Btn, {
					onClick: () => listQ.fetchNextPage(),
					disabled: listQ.isFetchingNextPage,
					"data-testid": "drive-load-more",
					children: i18nT("apps.awsControl.console.load_more")
				})
			}),
			/* @__PURE__ */ jsx(CliDrawer, {
				bucket,
				prefix: "drive/"
			}),
			share && /* @__PURE__ */ jsx(ShareDialog, {
				account,
				section: "drive",
				fileKey: share.key,
				onClose: () => {
					setShare(null);
					returnFocusToOpener();
				}
			}),
			moveTarget && /* @__PURE__ */ jsx(MoveDialog, {
				fileKey: moveTarget,
				currentPath: path,
				folders,
				pending: moveBusy,
				error: moveError,
				askAgent: handOff,
				onMove: (folder) => {
					const base = moveTarget.split("/").pop() ?? moveTarget;
					setMoveError(null);
					moveMut.mutate({
						fromKey: moveTarget,
						toKey: folder ? `${folder}/${base}` : base
					}, { onSuccess: () => {
						if (moveDialogOpenRef.current) closeMoveDialog();
					} });
				},
				onClose: closeMoveDialog,
				onNewFolder: searching ? void 0 : moveToNewFolder
			}),
			preview && /* @__PURE__ */ jsx(PreviewDialog, {
				account,
				entry: preview,
				onDownload: download,
				downloadError: downloadError?.key === preview.key ? downloadError : null,
				onClose: () => setPreview(null)
			})
		]
	});
}
// src/DrivePageBackup.tsx
/**
* AWS Control drive - the Backup pane: one row per backup kind with its run
* state and manual run, the two nightly consent switches, this install's label,
* and the stored-archive list with restore. `DrivePage.tsx` re-exports
* `BackupSection`.
*/
var START_ERROR_KEYS = {
	aws_consent_required: "apps.awsControl.console.backup_start_consent",
	drive_missing: "apps.awsControl.console.backup_start_no_drive",
	jobs_unavailable: "apps.awsControl.console.backup_start_unavailable"
};
/**
* Why the nightly transcript archive is not running, in the reader's language.
*
* The backend sends a stable code, not a sentence: it cannot know the reader's
* locale, so a sentence chosen there is English on every install. An unrecognised
* code falls through to the general line rather than rendering nothing, because a
* newer gateway can name a condition this build has never heard of -- and "on
* hold" is true of all of them, which is far better than letting the page imply
* the backup is fine.
*
* A switch over static map access rather than an indexed lookup, so every key
* here stays findable by the i18n gate instead of counting as a dynamic site.
*/
var BACKUP_BLOCKED_KEYS = {
	host: "apps.awsControl.console.backup_nightly_sessions_blocked_host",
	redaction: "apps.awsControl.console.backup_nightly_sessions_blocked_redaction",
	otherAccount: "apps.awsControl.console.backup_nightly_sessions_blocked_other_account",
	other: "apps.awsControl.console.backup_nightly_sessions_blocked_other"
};
var BACKUP_NEXT_KEYS = {
	generic: "apps.awsControl.console.backup_nightly_sessions_blocked_next",
	redaction: "apps.awsControl.console.backup_nightly_sessions_blocked_next_redaction"
};
var SNAPSHOT_BLOCKED_KEYS = { otherAccount: "apps.awsControl.console.backup_nightly_blocked_other_account" };
function nightlyBlockedText(code) {
	switch (code) {
		case "other_account": return i18nT(SNAPSHOT_BLOCKED_KEYS.otherAccount);
		default: return null;
	}
}
function nightlyBlockedNextText() {
	return i18nT(BACKUP_NEXT_KEYS.generic);
}
function nightlySessionsBlockedText(code) {
	switch (code) {
		case "host_unsupported": return i18nT(BACKUP_BLOCKED_KEYS.host);
		case "redaction_on": return i18nT(BACKUP_BLOCKED_KEYS.redaction);
		case "other_account": return i18nT(BACKUP_BLOCKED_KEYS.otherAccount);
		default: return i18nT(BACKUP_BLOCKED_KEYS.other);
	}
}
function nightlySessionsBlockedNextText(code) {
	if (code === "host_unsupported") return null;
	if (code === "redaction_on") return i18nT(BACKUP_NEXT_KEYS.redaction);
	return i18nT(BACKUP_NEXT_KEYS.generic);
}
var BACKUP_KIND_LABEL_KEY = {
	snapshot: "apps.awsControl.console.backup_kind_snapshot",
	sessions: "apps.awsControl.console.backup_kind_sessions"
};
var BACKUP_KINDS = ["snapshot", "sessions"];
/** Archives of each kind shown before the reader asks for the whole listing. */
var ARCHIVE_DISPLAY_CAP = 5;
/** The glyph each backup kind is recognised by. A snapshot is an archive of the
*  workspace; the sessions archive is a database dump, so they are not the same
*  picture. */
var BACKUP_KIND_ICON = {
	snapshot: /* @__PURE__ */ jsx(Archive, {
		className: "h-4 w-4",
		"aria-hidden": "true"
	}),
	sessions: /* @__PURE__ */ jsx(Database, {
		className: "h-4 w-4",
		"aria-hidden": "true"
	})
};
/**
* One backup kind's row.
*
* Its own component, rather than a `.map` body inside `BackupSection`, so each
* row's mutation state stays its own -- a click on one kind must not disable the
* other.
*
* `busy` comes from the SERVER, not from `runMut.isPending`. That is the whole
* change: the previous indicator lived in this component, so unmounting it
* destroyed the only record that a backup was in flight, and coming back showed
* an idle row while the upload continued. Under the rail that unmount is no
* longer hypothetical -- switching panes genuinely unmounts this subtree.
*/
function BackupRow({ account, kind, run, remembered, job, unsupported, onStarted, onShowArchives }) {
	const runMut = useMutation({
		mutationFn: () => awsControlApi.backupRun(account, kind),
		onSuccess: onStarted
	});
	const busy = job?.active != null || runMut.isPending;
	const failed = !busy ? job?.lastFailed ?? null : null;
	const code = runMut.error?.message ?? "";
	const retryable = code === "aws_call_failed" || /^http_5\d\d$/.test(code);
	const startError = runMut.isError ? i18nT(START_ERROR_KEYS[code] ?? (retryable ? "apps.awsControl.console.backup_start_retry" : "apps.awsControl.console.backup_start_failed")) : "";
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-wrap items-center gap-3 px-3 py-2.5",
		"data-testid": `backup-row-${kind}`,
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-muted",
				children: BACKUP_KIND_ICON[kind]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-[13px] font-medium text-text",
						children: i18nT(BACKUP_KIND_LABEL_KEY[kind])
					}),
					/* @__PURE__ */ jsx("div", {
						className: "text-[12px] text-muted",
						"data-testid": `backup-last-${kind}`,
						children: run ? i18nT("apps.awsControl.console.backup_last_run", {
							when: fmtRelative(run.at),
							size: fmtBytes(run.bytes)
						}) : remembered != null && remembered > 0 ? i18nT("apps.awsControl.console.backup_never_recorded") : i18nT("apps.awsControl.console.backup_never")
					}),
					remembered != null && remembered > (run ? 1 : 0) && /* @__PURE__ */ jsx("button", {
						onClick: onShowArchives,
						className: "text-[12px] text-muted hover:text-text cursor-pointer bg-transparent border-none p-0 text-left",
						"data-testid": `backup-remembered-${kind}`,
						children: i18nT("apps.awsControl.console.backup_remembered", { count: remembered })
					}),
					(failed || startError) && /* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent: true,
						error: startError ? runMut.error : void 0,
						message: startError || i18nT("apps.awsControl.console.backup_failed", { reason: failed?.error || "" }),
						variant: "inline",
						testId: `backup-error-${kind}`
					}),
					kind === "sessions" && /* @__PURE__ */ jsx("div", {
						className: "text-[12px] text-muted",
						"data-testid": "backup-sessions-scope",
						children: i18nT("apps.awsControl.console.backup_sessions_scope")
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ml-auto flex shrink-0 items-center gap-2",
				children: [/* @__PURE__ */ jsx(Badge, {
					variant: run ? "ok" : "muted",
					"data-testid": `backup-state-${kind}`,
					children: run ? i18nT("apps.awsControl.console.backup_state_current") : i18nT("apps.awsControl.console.backup_state_never")
				}), /* @__PURE__ */ jsxs(Btn, {
					onClick: () => runMut.mutate(),
					disabled: busy || unsupported,
					"data-testid": `backup-run-${kind}`,
					children: [/* @__PURE__ */ jsx(RefreshCw, {
						size: 13,
						className: busy ? "animate-spin" : ""
					}), busy ? i18nT("apps.awsControl.console.backup_running") : i18nT("apps.awsControl.console.backup_run_now")]
				})]
			})
		]
	});
}
/**
* The attribution string shown beside an archive row.
*
* The label is resolved by looking the row's owning `install` id up in the
* remote roster; a missing entry or an empty label falls back to the no-label
* form. The id decides everything a restore is allowed to do -- this string is
* only what a human reads.
*
*   self          <label> . this install
*   other +label  "<label>" (another install . <first 8 hex>)
*   other -label  another install . <first 8 hex>
*   legacy        unknown origin
*
* The double quotes around a foreign label are required: they carry the meaning
* "this string was written by whoever wrote the archive", not by us.
*/
function archiveAttribution(f, remote) {
	if (f.origin === "legacy") return i18nT("apps.awsControl.console.backup_origin_unknown");
	if (f.origin === "unverified") return i18nT("apps.awsControl.console.backup_attribution_unverified");
	const label = remote?.installs.find((i) => i.id === f.install)?.label ?? "";
	if (f.origin === "self") return label ? i18nT("apps.awsControl.console.backup_attribution_self", { label }) : i18nT("apps.awsControl.console.backup_attribution_self_unnamed");
	const id = f.install.slice(0, 8);
	return label ? i18nT("apps.awsControl.console.backup_attribution_other", {
		label,
		id
	}) : i18nT("apps.awsControl.console.backup_attribution_other_unnamed", { id });
}
function BackupSection({ account }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const [showRemote, setShowRemote] = useState(false);
	const remoteRef = useRef(null);
	const pendingRevealRef = useRef(false);
	const [showOthers, setShowOthers] = useState(false);
	const backupQ = useAppQuery([
		"backup",
		account,
		showRemote,
		showOthers
	], {
		queryFn: () => awsControlApi.backup(account, {
			remote: showRemote,
			others: showOthers
		}),
		placeholderData: (prev, prevQuery) => {
			const prevKey = prevQuery?.queryKey;
			return prevKey?.[prevKey.length - 3] === account ? prev : void 0;
		},
		refetchInterval: (query) => BACKUP_KINDS.some((k) => query.state.data?.jobs?.[k]?.active != null) ? 3e3 : false,
		staleTime: 0,
		refetchOnMount: "always"
	});
	const revealRemote = useCallback(() => {
		setShowRemote(true);
		pendingRevealRef.current = !backupQ.data?.remote;
		requestAnimationFrame(() => remoteRef.current?.scrollIntoView?.({
			block: "start",
			behavior: "smooth"
		}));
	}, [backupQ.data?.remote]);
	const invalidate = () => qc.invalidateQueries({ queryKey: appKey(["backup", account]) });
	const nightlyMut = useMutation({
		mutationFn: (enabled) => awsControlApi.backupNightly(account, enabled),
		onSuccess: invalidate
	});
	const nightlySessionsMut = useMutation({
		mutationFn: (enabled) => awsControlApi.backupNightlySessions(account, enabled),
		onSuccess: invalidate
	});
	const [editingLabel, setEditingLabel] = useState(false);
	const [labelDraft, setLabelDraft] = useState("");
	const labelMut = useMutation({
		mutationFn: (label) => awsControlApi.installLabel(label),
		onSuccess: () => {
			setEditingLabel(false);
			invalidate();
		}
	});
	const [confirmKey, setConfirmKey] = useState(null);
	const [showAllArchives, setShowAllArchives] = useState(false);
	const restoreButtons = useRef(/* @__PURE__ */ new Map());
	const confirmNoButtons = useRef(/* @__PURE__ */ new Map());
	const [focusTarget, setFocusTarget] = useState(null);
	const archiveIds = useId();
	const restoreMut = useMutation({
		mutationFn: (v) => awsControlApi.backupRestore(account, v.key, v.foreignOk),
		onError: (error, v) => {
			if (!v.foreignOk && error?.message === "foreign_install_archive") {
				setConfirmKey(v.key);
				setFocusTarget({
					key: v.key,
					to: "strip",
					ifDropped: true
				});
			}
		}
	});
	const data = backupQ.data;
	const renderedRows = BACKUP_KINDS.flatMap((kind) => (data?.remote?.[kind] ?? []).slice(0, showAllArchives ? void 0 : ARCHIVE_DISPLAY_CAP));
	const listedArchiveCount = BACKUP_KINDS.reduce((n, kind) => n + (data?.remote?.[kind]?.length ?? 0), 0);
	useEffect(() => {
		if (focusTarget === null) return;
		const el = focusTarget.to === "strip" ? confirmNoButtons.current.get(focusTarget.key) : restoreButtons.current.get(focusTarget.key);
		if (el?.disabled) {
			if (!focusTarget.ifDropped) setFocusTarget({
				...focusTarget,
				ifDropped: true
			});
			return;
		}
		const dropped = !document.activeElement || document.activeElement === document.body;
		if (el && (!focusTarget.ifDropped || dropped)) el.focus();
		setFocusTarget(null);
	}, [
		focusTarget,
		confirmKey,
		restoreMut.isPending,
		renderedRows.length
	]);
	useEffect(() => {
		if (!pendingRevealRef.current) return;
		if (!data?.remote) {
			if (data?.remoteError) pendingRevealRef.current = false;
			return;
		}
		pendingRevealRef.current = false;
		requestAnimationFrame(() => remoteRef.current?.scrollIntoView?.({
			block: "start",
			behavior: "smooth"
		}));
	}, [data?.remote, data?.remoteError]);
	const refusedKey = restoreMut.variables?.key;
	const refusalAnswered = confirmKey !== null && confirmKey === refusedKey && showRemote && renderedRows.some((f) => f.key === confirmKey);
	const refusedSelf = BACKUP_KINDS.some((kind) => (data?.remote?.[kind] ?? []).some((f) => f.key === refusedKey && f.origin === "self"));
	const rowCount = renderedRows.length;
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "backup-section",
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(Archive, { size: 18 }),
				title: i18nT("apps.awsControl.console.backup_title")
			}),
			backupQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 2 }),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: backupQ.error,
				message: backupQ.isError ? i18nT("apps.awsControl.console.backup_status_failed") : null,
				onRetry: () => backupQ.refetch(),
				testId: "backup-status-error"
			}),
			data && /* @__PURE__ */ jsxs(Card, {
				className: "px-2 py-3 md:px-3",
				children: [/* @__PURE__ */ jsx(PanelSectionHeader, {
					label: i18nT("apps.awsControl.console.backup_title"),
					count: BACKUP_KINDS.length,
					className: "mb-1 px-1"
				}), /* @__PURE__ */ jsxs("div", {
					className: "divide-y divide-border",
					children: [
						BACKUP_KINDS.map((kind) => /* @__PURE__ */ jsx(BackupRow, {
							account,
							kind,
							run: data.runs[kind],
							remembered: data.rememberedArchives?.[kind],
							job: data.jobs?.[kind],
							unsupported: kind === "sessions" && data.nightlySessionsBlocked === "host_unsupported",
							onStarted: invalidate,
							onShowArchives: revealRemote
						}, kind)),
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between gap-3 px-3 py-2.5",
							"data-testid": "backup-nightly",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-[13px] font-medium text-text",
									children: i18nT("apps.awsControl.console.backup_nightly")
								}), /* @__PURE__ */ jsx("div", {
									className: "text-[12px] text-muted",
									children: i18nT("apps.awsControl.console.backup_nightly_hint")
								})]
							}), /* @__PURE__ */ jsx(Toggle, {
								checked: data.nightly,
								onChange: (v) => nightlyMut.mutate(v),
								label: i18nT("apps.awsControl.console.backup_nightly")
							})]
						}),
						nightlyMut.isError && /* @__PURE__ */ jsx("div", {
							className: "px-3 py-2",
							children: /* @__PURE__ */ jsx(AwsErrorNotice, {
								askAgent: true,
								error: nightlyMut.error,
								message: i18nT("apps.awsControl.console.backup_nightly_failed", { setting: i18nT("apps.awsControl.console.backup_nightly") }),
								testId: "backup-nightly-error"
							})
						}),
						data.nightly === true && data.nightlyBlocked ? /* @__PURE__ */ jsx("div", {
							className: "px-3 pb-2 text-[12px] text-warn",
							"data-testid": "backup-nightly-blocked",
							children: [nightlyBlockedText(data.nightlyBlocked), nightlyBlockedNextText()].filter(Boolean).join(" ")
						}) : null,
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between gap-3 px-3 py-2.5",
							"data-testid": "backup-nightly-sessions",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-[13px] font-medium text-text",
									children: i18nT("apps.awsControl.console.backup_nightly_sessions")
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-[12px] text-muted",
									children: [
										i18nT("apps.awsControl.console.backup_nightly_sessions_hint"),
										" ",
										i18nT("apps.awsControl.console.backup_sessions_scope"),
										" ",
										i18nT("apps.awsControl.console.backup_nightly_sessions_destination", { button: i18nT("apps.awsControl.console.backup_run_now") })
									]
								})]
							}), /* @__PURE__ */ jsx(Toggle, {
								checked: data.nightlySessions === true,
								onChange: (v) => nightlySessionsMut.mutate(v),
								label: i18nT("apps.awsControl.console.backup_nightly_sessions")
							})]
						}),
						data.nightlySessions === true && data.nightlySessionsBlocked ? /* @__PURE__ */ jsx("div", {
							className: "px-3 pb-2 text-[12px] text-warn",
							"data-testid": "backup-nightly-sessions-blocked",
							children: [nightlySessionsBlockedText(data.nightlySessionsBlocked), nightlySessionsBlockedNextText(data.nightlySessionsBlocked)].filter(Boolean).join(" ")
						}) : null,
						nightlySessionsMut.isError && /* @__PURE__ */ jsx("div", {
							className: "px-3 py-2",
							children: /* @__PURE__ */ jsx(AwsErrorNotice, {
								askAgent: true,
								error: nightlySessionsMut.error,
								message: i18nT("apps.awsControl.console.backup_nightly_failed", { setting: i18nT("apps.awsControl.console.backup_nightly_sessions") }),
								testId: "backup-nightly-sessions-error"
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center gap-3 px-3 py-2.5",
							"data-testid": "backup-install",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-[13px] font-medium text-text",
									children: i18nT("apps.awsControl.console.backup_install")
								}), editingLabel ? /* @__PURE__ */ jsxs("div", {
									className: "mt-1 flex flex-wrap items-center gap-2",
									children: [
										/* @__PURE__ */ jsx(Input, {
											"aria-label": i18nT("apps.awsControl.console.backup_install_name_label"),
											value: labelDraft,
											onChange: (e) => setLabelDraft(e.target.value),
											onKeyDown: (e) => {
												if (e.key === "Enter") labelMut.mutate(labelDraft);
												if (e.key === "Escape") {
													setEditingLabel(false);
													labelMut.reset();
												}
											},
											autoFocus: true,
											disabled: labelMut.isPending,
											"data-testid": "backup-install-name",
											className: "min-w-0 flex-1"
										}),
										/* @__PURE__ */ jsx(Btn, {
											primary: true,
											onClick: () => labelMut.mutate(labelDraft),
											disabled: labelMut.isPending,
											"data-testid": "backup-install-save",
											children: i18nT("apps.awsControl.console.backup_install_save")
										}),
										/* @__PURE__ */ jsx(Btn, {
											onClick: () => {
												setEditingLabel(false);
												labelMut.reset();
											},
											disabled: labelMut.isPending,
											"data-testid": "backup-install-cancel",
											children: i18nT("apps.awsControl.console.backup_restore_confirm_no")
										})
									]
								}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("div", {
									className: "text-[12px]",
									children: /* @__PURE__ */ jsx("span", {
										className: "font-medium text-text",
										"data-testid": "backup-install-label",
										children: data.install.label
									})
								}), /* @__PURE__ */ jsx("div", {
									className: "text-[12px] text-muted",
									children: i18nT("apps.awsControl.console.backup_install_hint")
								})] })]
							}), !editingLabel && /* @__PURE__ */ jsxs(Btn, {
								className: "ml-auto shrink-0",
								onClick: () => {
									setLabelDraft(data.install.label);
									setEditingLabel(true);
								},
								"data-testid": "backup-install-rename",
								children: [/* @__PURE__ */ jsx(Pencil, { size: 13 }), i18nT("apps.awsControl.console.backup_install_rename")]
							})]
						}),
						labelMut.isError && /* @__PURE__ */ jsx("div", {
							className: "px-3 py-2",
							children: /* @__PURE__ */ jsx(AwsErrorNotice, {
								error: labelMut.error,
								message: i18nT("apps.awsControl.console.backup_install_rename_failed"),
								testId: "backup-install-error"
							})
						})
					]
				})]
			}),
			data?.remoteError && /* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				title: i18nT("apps.awsControl.console.backup_remote_error"),
				message: data.remoteError,
				className: "mt-2",
				testId: "backup-remote-error"
			}),
			data && /* @__PURE__ */ jsxs("div", {
				className: "mt-2",
				ref: remoteRef,
				children: [
					/* @__PURE__ */ jsxs("button", {
						onClick: () => setShowRemote((v) => {
							if (v) pendingRevealRef.current = false;
							return !v;
						}),
						className: "inline-flex items-center gap-1 text-[12px] text-muted hover:text-text cursor-pointer bg-transparent border-none p-0",
						"aria-expanded": showRemote,
						"data-testid": "backup-remote-toggle",
						children: [i18nT("apps.awsControl.console.backup_archive"), /* @__PURE__ */ jsx(ChevronDown, {
							size: 12,
							className: `transition-transform ${showRemote ? "rotate-180" : ""}`
						})]
					}),
					showRemote && /* @__PURE__ */ jsxs("div", {
						className: "mt-1.5 rounded-md border border-border bg-card",
						"data-testid": "backup-archive",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center justify-between gap-3 border-b border-border px-3 py-2.5",
								"data-testid": "backup-others-toggle",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ jsx("div", {
										className: "text-[13px] font-medium text-text",
										children: i18nT("apps.awsControl.console.backup_show_others")
									}), data.remote && data.remote.others > 0 && /* @__PURE__ */ jsx("div", {
										className: "text-[12px] text-muted",
										"data-testid": "backup-others-on-drive",
										children: i18nT("apps.awsControl.console.backup_others_on_drive", { count: data.remote.others })
									})]
								}), /* @__PURE__ */ jsx(Toggle, {
									checked: showOthers,
									onChange: (v) => setShowOthers(v),
									label: i18nT("apps.awsControl.console.backup_show_others")
								})]
							}),
							data.remote && data.remote.others > 0 && /* @__PURE__ */ jsx("p", {
								className: "border-b border-border px-3 py-2 text-[12px] text-muted",
								"data-testid": "backup-shared-note",
								children: i18nT("apps.awsControl.console.backup_shared_note")
							}),
							data.remote?.truncated && /* @__PURE__ */ jsx("p", {
								className: "border-b border-border px-3 py-2 text-[12px] text-muted",
								"data-testid": "backup-others-truncated",
								children: i18nT("apps.awsControl.console.backup_others_truncated", { max: data.remote.max })
							}),
							BACKUP_KINDS.filter((kind) => {
								const capped = data.remote?.archives_truncated;
								return Array.isArray(capped) && capped.includes(kind);
							}).map((kind) => /* @__PURE__ */ jsx("p", {
								className: "border-b border-border px-3 py-2 text-[12px] text-warn",
								"data-testid": "backup-archives-truncated",
								children: i18nT("apps.awsControl.console.backup_archives_truncated", { kind: i18nT(BACKUP_KIND_LABEL_KEY[kind]) })
							}, kind)),
							/* @__PURE__ */ jsxs("div", {
								className: "divide-y divide-border",
								children: [rowCount === 0 && !showOthers && (data.remote?.others ?? 0) > 0 && /* @__PURE__ */ jsx("p", {
									className: "px-3 py-2 text-[12px] text-muted",
									"data-testid": "backup-no-own-archives",
									children: i18nT("apps.awsControl.console.backup_none_from_this_install")
								}), renderedRows.map((f, i) => {
									const asking = confirmKey === f.key;
									const labelId = `${archiveIds}-restore-${i}`;
									const keyId = `${archiveIds}-key-${i}`;
									return /* @__PURE__ */ jsxs("div", {
										"data-testid": "backup-archive-row",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]",
											children: [
												/* @__PURE__ */ jsx("span", {
													id: keyId,
													className: "min-w-0 flex-1 truncate font-mono text-text",
													"data-testid": "backup-archive-key",
													children: f.key
												}),
												/* @__PURE__ */ jsx("span", {
													className: "basis-full shrink-0 text-muted sm:basis-auto",
													"data-testid": "backup-archive-origin",
													children: archiveAttribution(f, data.remote)
												}),
												/* @__PURE__ */ jsx("span", {
													className: "hidden shrink-0 text-muted sm:inline",
													children: fmtBytes(f.size)
												}),
												/* @__PURE__ */ jsxs(Btn, {
													ref: (el) => {
														if (el) restoreButtons.current.set(f.key, el);
														else restoreButtons.current.delete(f.key);
													},
													onClick: () => {
														if (f.origin === "self") restoreMut.mutate({ key: f.key });
														else {
															setConfirmKey(f.key);
															setFocusTarget({
																key: f.key,
																to: "strip"
															});
														}
													},
													disabled: restoreMut.isPending,
													"aria-labelledby": `${labelId} ${keyId}`,
													"data-testid": "backup-restore",
													children: [/* @__PURE__ */ jsx(Download, { size: 13 }), /* @__PURE__ */ jsx("span", {
														id: labelId,
														children: i18nT("apps.awsControl.console.backup_restore")
													})]
												})
											]
										}), asking && /* @__PURE__ */ jsxs("div", {
											className: "flex flex-wrap items-center gap-2 px-3 pb-2.5",
											"data-testid": "backup-restore-confirm",
											children: [
												/* @__PURE__ */ jsx("p", {
													className: "basis-full text-[12px] text-muted",
													children: f.origin === "legacy" ? i18nT("apps.awsControl.console.backup_restore_unknown_confirm") : f.origin === "unverified" ? i18nT("apps.awsControl.console.backup_restore_unverified_confirm") : f.origin === "self" ? i18nT("apps.awsControl.console.backup_restore_overwritten_confirm") : i18nT("apps.awsControl.console.backup_restore_foreign_confirm", { install: f.install.slice(0, 8) })
												}),
												/* @__PURE__ */ jsx(Btn, {
													onClick: () => {
														restoreMut.mutate({
															key: f.key,
															foreignOk: true
														});
														setConfirmKey(null);
														setFocusTarget({
															key: f.key,
															to: "row",
															ifDropped: true
														});
													},
													disabled: restoreMut.isPending,
													"data-testid": "backup-restore-confirm-yes",
													children: i18nT("apps.awsControl.console.backup_restore_confirm_yes")
												}),
												/* @__PURE__ */ jsx(Btn, {
													onClick: () => {
														if (f.key === restoreMut.variables?.key && restoreMut.isError && restoreMut.error?.message === "foreign_install_archive") restoreMut.reset();
														setConfirmKey(null);
														setFocusTarget({
															key: f.key,
															to: "row"
														});
													},
													ref: (el) => {
														if (el) confirmNoButtons.current.set(f.key, el);
														else confirmNoButtons.current.delete(f.key);
													},
													"data-testid": "backup-restore-confirm-no",
													children: i18nT("apps.awsControl.console.backup_restore_confirm_no")
												})
											]
										})]
									}, f.key);
								})]
							}),
							!showAllArchives && listedArchiveCount > renderedRows.length && /* @__PURE__ */ jsx("div", {
								className: "border-t border-border px-3 py-2",
								children: /* @__PURE__ */ jsx(Btn, {
									onClick: () => {
										const shown = new Set(renderedRows.map((f) => f.key));
										const firstHidden = BACKUP_KINDS.flatMap((kind) => data.remote?.[kind] ?? []).find((f) => !shown.has(f.key));
										if (firstHidden) setFocusTarget({
											key: firstHidden.key,
											to: "row"
										});
										setShowAllArchives(true);
									},
									"data-testid": "backup-show-all-archives",
									children: i18nT("apps.awsControl.console.backup_show_all_archives", { count: fmtNumber(listedArchiveCount) })
								})
							})
						]
					}),
					showRemote && /* @__PURE__ */ jsx("p", {
						className: "mt-1.5 text-[12px] text-muted",
						"data-testid": "backup-restore-caveat",
						children: i18nT("apps.awsControl.console.backup_restore_caveat")
					})
				]
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: restoreMut.error,
				message: restoreMut.isError ? restoreMut.error?.message === "foreign_install_archive" ? refusalAnswered ? null : i18nT(refusedSelf ? "apps.awsControl.console.backup_restore_overwritten_refused" : "apps.awsControl.console.backup_restore_foreign_refused") : i18nT("apps.awsControl.console.backup_restore_failed") : null,
				className: "mt-2",
				testId: "backup-restore-error"
			}),
			/* @__PURE__ */ jsx("div", {
				role: "status",
				"data-testid": "backup-restored-status",
				children: restoreMut.data && /* @__PURE__ */ jsxs("div", {
					className: "mt-2 rounded-md border border-border bg-bg-elevated p-2.5 text-[12px]",
					"data-testid": "backup-restored",
					children: [
						restoreMut.data.recovered && /* @__PURE__ */ jsxs("p", {
							className: "mb-2 flex items-start gap-1.5 text-warn",
							"data-testid": "backup-restore-recovered",
							children: [/* @__PURE__ */ jsx(AlertTriangle, { className: "lucide-inline" }), /* @__PURE__ */ jsx("span", { children: i18nT("apps.awsControl.console.backup_restore_recovered_note") })]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mb-1 text-muted",
							children: i18nT("apps.awsControl.console.backup_restored_note")
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("code", {
								className: "flex-1 min-w-0 break-all rounded bg-bg px-2 py-1.5 font-mono text-[12px] text-text",
								children: restoreMut.data.path
							}), /* @__PURE__ */ jsx(CopyBtn, { text: restoreMut.data.path })]
						})
					]
				})
			})
		]
	});
}
// src/DrivePage.tsx
/**
* AWS Control - the cloud drive, as its own page.
*
* Reached from the Cloud drive capability row on the account console; a
* breadcrumb returns. Like the console it is view state inside `AwsControlPage`
* rather than a route of its own, because `BuiltinAppRoute` resolves only
* single-segment routes.
*
* One bucket holds three sections behind their own prefixes - the artifact
* library, the file drive, and backups - and this page is where all three live,
* together with the share ledger that governs links into them. They were four
* stacked sections on the account console; that page now carries one row saying
* the drive exists, and everything about its CONTENTS is here.
*
* The file listing renders through the shared library table header
* (`components/library/LibraryTable`), declaring its own columns: an S3 object
* has no slug, kind, source, version or tags, so the artifact library's nine
* columns would have to be invented for it. What IS shared is the header chrome
* - the sort control and the pinned Actions cell with its measured seam - which
* is the part that is subtle and expensive to keep in sync by hand.
*
* Every mutation is confirmed before it runs and ends by invalidating its
* react-query key. All AWS access runs through the gateway's audited CLI
* chokepoint; this surface never talks to AWS from the browser.
*
* This file is the import path every consumer uses. It keeps the page's own
* section map (`SECTION_TILES`), the storage meter and the share ledger
* (`AccessSection`), and re-exports each pane from its owner:
* `DrivePageLibrary.tsx` (Library); `DrivePageFiles.tsx`, `useDrivePageFiles.ts`,
* `DrivePageFilesViews.tsx` and `DrivePageFileDialogs.tsx` (Files);
* `DrivePageBackup.tsx` (Backup); and `DrivePageControls.tsx`, the controls
* more than one pane draws. Owners never import this file.
*/
function AccessSection({ account }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const sharesQ = useAppQuery(["shares", account], { queryFn: () => awsControlApi.shares(account) });
	const forgetMut = useMutation({
		mutationFn: (id) => awsControlApi.shareForget(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: appKey(["shares", account]) })
	});
	const shares = sharesQ.data?.shares ?? [];
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "access-section",
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(Share2, { size: 18 }),
				title: i18nT("apps.awsControl.console.access_title")
			}),
			sharesQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 1 }),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: sharesQ.error,
				message: sharesQ.isError ? i18nT("apps.awsControl.console.access_list_failed") : null,
				onRetry: () => sharesQ.refetch(),
				testId: "access-list-error"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: forgetMut.error,
				message: forgetMut.isError ? i18nT("apps.awsControl.console.access_forget_failed") : null,
				className: "mb-2",
				testId: "access-forget-error"
			}),
			sharesQ.data && shares.length === 0 && /* @__PURE__ */ jsx(EmptyState, {
				icon: /* @__PURE__ */ jsx(Share2, {
					className: "h-10 w-10",
					"aria-hidden": "true"
				}),
				title: i18nT("apps.awsControl.console.access_empty"),
				testId: "access-empty"
			}),
			shares.length > 0 && /* @__PURE__ */ jsxs(Card, {
				className: "px-2 py-3 md:px-3",
				"data-testid": "access-list",
				children: [/* @__PURE__ */ jsx(PanelSectionHeader, {
					label: i18nT("apps.awsControl.console.access_title"),
					count: shares.length,
					className: "mb-1 px-1"
				}), /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-border",
					children: shares.map((s) => /* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]",
						"data-testid": "access-row",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-muted",
								children: /* @__PURE__ */ jsx(Link2, {
									className: "h-4 w-4",
									"aria-hidden": "true"
								})
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "min-w-[8rem] flex-1 truncate font-mono text-text",
											children: s.key
										}),
										/* @__PURE__ */ jsx(Badge, {
											variant: "muted",
											children: i18nT(SECTION_LABEL_ON_PAGE[s.section])
										}),
										s.objectMissing && /* @__PURE__ */ jsx(Badge, {
											variant: "warn",
											"data-testid": "access-object-missing",
											children: i18nT("apps.awsControl.console.access_object_missing")
										})
									]
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-[12px] text-muted",
									children: [s.note ? `${s.note} · ` : "", i18nT("apps.awsControl.console.access_expires_in", { when: fmtRelative(s.expiresAt) })]
								})]
							}),
							/* @__PURE__ */ jsx(Btn, {
								className: "ml-auto shrink-0",
								onClick: () => forgetMut.mutate(s.id),
								disabled: forgetMut.isPending,
								"data-testid": "access-forget",
								children: i18nT("apps.awsControl.console.access_forget")
							})
						]
					}, s.id))
				})]
			}),
			shares.length > 0 && sharesQ.data?.checked === false && /* @__PURE__ */ jsxs("p", {
				className: "mt-2 flex items-start gap-1.5 text-[12px] text-warn",
				"data-testid": "access-unchecked",
				children: [/* @__PURE__ */ jsx(AlertTriangle, { className: "lucide-inline" }), /* @__PURE__ */ jsx("span", { children: i18nT("apps.awsControl.console.access_unchecked") })]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 text-[12px] text-muted",
				children: i18nT("apps.awsControl.console.access_footer")
			})
		]
	});
}
/** The three sections of the bucket, in the order a reader meets them. */
var SECTIONS = [
	"drive",
	"library",
	"backup"
];
/**
* Section names AS SEEN ON THIS PAGE.
*
* The bucket's `drive/` prefix is called "Drive" elsewhere, but this page is
* itself the drive - so inside it that section is "Files". This is the ONLY
* naming map left: a second one saying "Drive" printed that name as the page
* title, the section row, the section header AND an access row's badge, so one
* folder answered to two names on a page whose whole job is telling the folders
* apart. There is no longer anywhere on this page that calls it "Drive".
*/
var SECTION_LABEL_ON_PAGE = {
	drive: "apps.awsControl.console.section_files",
	library: "apps.awsControl.console.section_library",
	backup: "apps.awsControl.console.section_backup"
};
/** The glyph each section is recognised by, the same one its pane header wears. */
var SECTION_ICON = {
	drive: FolderClosed,
	library: Library,
	backup: Archive
};
/**
* The one section → glyph + label map every section tile draws from. The
* storage meter here and the Overview's drive card render the same three
* tiles, and two maps for one fact is how a renamed section ends up with two
* icons.
*/
var SECTION_TILES = SECTIONS.map((section) => ({
	section,
	icon: SECTION_ICON[section],
	labelKey: SECTION_LABEL_ON_PAGE[section]
}));
/**
* The storage meter: one horizontal bar split by section, and a quick tile per
* section.
*
* The bar is proportional to each section's BYTES, but a section with zero
* bytes still gets a legible legend row (its swatch and a `0` size) — a section
* that exists is worth naming even when empty, and a 0-width bar segment alone
* would silently drop it. When the whole drive is empty the bar renders as a
* single muted track so the card is never a bare outline.
*
* Exported because the pane that owns "what is using storage" places it; this
* file only owns what it looks like. Its section readings are read-only rows:
* the meter sits on the Usage pane, and every section it names is one rail
* click away already.
*/
function StorageMeter({ usage }) {
	return /* @__PURE__ */ jsxs(Card, {
		"data-testid": "drive-storage-meter",
		children: [
			/* @__PURE__ */ jsx(PanelSectionHeader, { label: i18nT("apps.awsControl.console.root_storage_used") }),
			/* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(StorageBar, {
					usage,
					testId: "drive-meter"
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3",
				"data-testid": "drive-meter-tiles",
				children: SECTION_TILES.map(({ section, icon: Icon, labelKey }) => /* @__PURE__ */ jsx(QuickTile, {
					testId: `drive-meter-tile-${section}`,
					icon: /* @__PURE__ */ jsx(Icon, {
						className: "h-4 w-4",
						"aria-hidden": "true"
					}),
					label: i18nT(labelKey),
					count: i18nT("apps.awsControl.console.root_section_objects", {
						count: usage.sections[section].objects,
						objects: fmtNumber(usage.sections[section].objects)
					})
				}, section))
			})
		]
	});
}
// src/ConsoleView.tsx
/**
* AWS Control — the Usage & costs pane, plus the account plumbing the other
* rail panes share (`ReconnectAction`, `ConnectionsSection`, `SetupCard`).
*
* The per-account console this file used to be dissolved into the flat-rail
* layout in `AwsControlPage`: the drive's sections are rail items of their own,
* connections live on the Accounts & credentials pane, and the money-shaped
* facts (bill, storage meter, consent receipts) landed here. Every mutation is
* confirmed before it runs and ends by invalidating its react-query key. All
* AWS access runs through the gateway's audited CLI chokepoint — this surface
* never talks to AWS from the browser.
*/
/** Credential-kind badge label, keyed literally (dynamicKeys gate). */
var PROFILE_KIND_LABEL_KEY = {
	sso: "apps.awsControl.page.kind_sso",
	"credential-process": "apps.awsControl.page.kind_credential_process",
	other: "apps.awsControl.page.kind_other"
};
/** One plain sentence of Reconnect guidance per credential kind. */
var RECONNECT_HINT_KEY = {
	sso: "apps.awsControl.page.reconnect_hint_sso",
	"credential-process": "apps.awsControl.page.reconnect_hint_credential_process",
	other: "apps.awsControl.page.reconnect_hint_other"
};
/**
* Inline Reconnect for a failing key, moved here from the Accounts list. Fetches
* the profile's reconnect-plan on demand and shows the command in a mono block
* with a copy button plus a one-sentence hint for its credential kind.
*
* `askAgent` is the host's call, not this component's: the same Reconnect
* renders on the accounts pane next to the Add-accounts checkboxes, and a
* hand-off there navigates away from a ticked-but-unregistered selection.
*/
function ReconnectAction({ profile, askAgent }) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const planQ = useAppQuery(["reconnect-plan", profile.name], {
		queryFn: () => awsControlApi.reconnectPlan(profile.name),
		enabled: open
	});
	const copy = async () => {
		if (!planQ.data) return;
		if (await copyCode(planQ.data.command)) {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-2",
		"data-testid": "reconnect",
		children: [
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent,
				message: profile.detail,
				className: "mb-2",
				testId: "reconnect-detail"
			}),
			/* @__PURE__ */ jsxs(Btn, {
				onClick: () => setOpen((v) => !v),
				"data-testid": "reconnect-toggle",
				"aria-expanded": open,
				children: [
					/* @__PURE__ */ jsx(RefreshCw, { size: 13 }),
					i18nT("apps.awsControl.page.reconnect"),
					/* @__PURE__ */ jsx(ChevronDown, {
						size: 13,
						className: `transition-transform ${open ? "rotate-180" : ""}`
					})
				]
			}),
			open && /* @__PURE__ */ jsxs("div", {
				className: "mt-2 rounded-md border border-border bg-bg-elevated p-3 text-[13px]",
				"data-testid": "reconnect-panel",
				children: [
					planQ.isLoading && /* @__PURE__ */ jsx("div", {
						className: "text-muted",
						"data-testid": "reconnect-loading",
						children: i18nT("apps.awsControl.page.reconnect_loading")
					}),
					/* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent,
						error: planQ.error,
						message: planQ.isError ? i18nT("apps.awsControl.page.reconnect_error") : null,
						onRetry: () => planQ.refetch(),
						testId: "reconnect-error"
					}),
					planQ.data && /* @__PURE__ */ jsxs(Fragment$1, { children: [
						/* @__PURE__ */ jsx("p", {
							className: "mb-2 text-[12px] text-muted",
							children: i18nT(RECONNECT_HINT_KEY[planQ.data.kind])
						}),
						/* @__PURE__ */ jsx("code", {
							className: "block min-w-0 break-all rounded bg-bg px-2 py-1.5 font-mono text-[12px] text-text",
							"data-testid": "reconnect-command",
							children: planQ.data.command
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-2 flex justify-end",
							children: /* @__PURE__ */ jsxs(Btn, {
								onClick: copy,
								"data-testid": "reconnect-copy",
								children: [copied ? /* @__PURE__ */ jsx(Check, {
									size: 13,
									className: "text-ok"
								}) : /* @__PURE__ */ jsx(Copy, { size: 13 }), copied ? i18nT("apps.awsControl.page.copied") : i18nT("apps.awsControl.page.copy")]
							})
						})
					] })
				]
			})
		]
	});
}
/** One row per profile/key: name, kind, region, health + Reconnect if failing. */
function ConnectionRow({ profile, askAgent }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "px-1 py-2.5 md:px-3",
		"data-testid": "connection-row",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-x-3 gap-y-2",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1 basis-[11rem]",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "min-w-0 truncate font-mono text-[13px] text-text-strong",
							"data-testid": "connection-name",
							children: profile.name
						}),
						profile.default && /* @__PURE__ */ jsxs(Badge, {
							variant: "muted",
							className: "shrink-0",
							"data-testid": "connection-default",
							children: [/* @__PURE__ */ jsx(Star, {
								className: "h-3 w-3 fill-accent text-accent",
								"aria-hidden": "true"
							}), i18nT("apps.awsControl.page.default_profile")]
						}),
						/* @__PURE__ */ jsx(Badge, {
							variant: "muted",
							children: i18nT(PROFILE_KIND_LABEL_KEY[profile.kind])
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-0.5 font-mono text-[12px] text-muted",
					children: profile.region
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: `h-2 w-2 shrink-0 rounded-full ${profile.identityOk ? "bg-ok" : "bg-warn"}`,
					"aria-hidden": "true",
					"data-testid": "connection-health",
					"data-ok": profile.identityOk
				}), /* @__PURE__ */ jsx(Badge, {
					variant: profile.identityOk ? "ok" : "warn",
					children: profile.identityOk ? i18nT("apps.awsControl.console.key_healthy") : i18nT("apps.awsControl.console.key_needs_attention")
				})]
			})]
		}), !profile.identityOk && /* @__PURE__ */ jsx(ReconnectAction, {
			profile,
			askAgent
		})]
	});
}
/**
* The keys card for ONE account: a row per key, with inline Reconnect for
* failing ones. The title names the account, because this card sits under a
* list of several accounts and a bare heading read as a global list — a reader
* concluded the other accounts had no keys. `askAgent` flows down to the
* Reconnect notices; the accounts pane that hosts this card decides it from
* whether a registration draft is open.
*/
function ConnectionsSection({ account, askAgent }) {
	return /* @__PURE__ */ jsxs(Card, {
		"data-testid": "connections-section",
		children: [/* @__PURE__ */ jsxs(CardTitle, { children: [/* @__PURE__ */ jsx(KeyRound, {
			className: "h-3.5 w-3.5 shrink-0 text-accent",
			"aria-hidden": "true"
		}), i18nT("apps.awsControl.console.keys_for_account", { name: account.name || account.account })] }), account.profiles.length === 0 ? /* @__PURE__ */ jsx("p", {
			className: "text-[13px] text-muted",
			"data-testid": "connections-empty",
			children: i18nT("apps.awsControl.page.not_connected_yet")
		}) : /* @__PURE__ */ jsx("div", {
			className: "divide-y divide-border",
			"data-testid": "connections-list",
			children: account.profiles.map((p) => /* @__PURE__ */ jsx(ConnectionRow, {
				profile: p,
				askAgent
			}, p.name))
		})]
	});
}
function SetupCard({ account, region, searchedRegion }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const [showPolicy, setShowPolicy] = useState(false);
	const previewMut = useMutation({ mutationFn: () => awsControlApi.driveBootstrapPreview(account) });
	const confirmMut = useMutation({
		mutationFn: () => awsControlApi.driveBootstrapConfirm(account),
		onSuccess: () => qc.invalidateQueries({ queryKey: appKey(["drive", account]) })
	});
	const policyQ = useAppQuery(["iam-policy"], {
		queryFn: () => awsControlApi.iamPolicy(),
		enabled: showPolicy
	});
	const preview = previewMut.data;
	const busy = previewMut.isPending || confirmMut.isPending;
	return /* @__PURE__ */ jsxs(Card, {
		className: "mb-0",
		"data-testid": "drive-setup",
		children: [
			/* @__PURE__ */ jsxs(CardTitle, { children: [/* @__PURE__ */ jsx(Cloud, {
				className: "h-3.5 w-3.5 shrink-0 text-accent",
				"aria-hidden": "true"
			}), i18nT("apps.awsControl.console.setup_title")] }),
			/* @__PURE__ */ jsx("p", {
				className: "mb-1 text-[13px] text-muted",
				children: i18nT("apps.awsControl.console.setup_body")
			}),
			searchedRegion && /* @__PURE__ */ jsx("p", {
				className: "mb-1 text-[13px] text-muted",
				"data-testid": "drive-searched-region",
				children: i18nT("apps.awsControl.console.setup_searched_region", { region: searchedRegion })
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mb-3 text-[13px] text-muted",
				children: i18nT("apps.awsControl.console.setup_costs_note")
			}),
			preview && !confirmMut.isSuccess && /* @__PURE__ */ jsx("div", {
				className: "mb-3 rounded-md border border-border bg-bg-elevated p-3",
				"data-testid": "drive-preview",
				children: /* @__PURE__ */ jsxs("dl", {
					className: "grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]",
					children: [
						/* @__PURE__ */ jsx("dt", {
							className: "text-[12px] text-muted",
							children: i18nT("apps.awsControl.console.setup_preview_region")
						}),
						/* @__PURE__ */ jsx("dd", {
							className: "mb-1 min-w-0 break-all font-mono text-[13px] text-text sm:mb-0",
							children: preview.region || region
						}),
						/* @__PURE__ */ jsx("dt", {
							className: "text-[12px] text-muted",
							children: i18nT("apps.awsControl.console.setup_preview_resource")
						}),
						/* @__PURE__ */ jsx("dd", {
							className: "min-w-0 break-all font-mono text-[13px] text-text",
							children: preview.resource
						})
					]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [!preview && /* @__PURE__ */ jsx(Btn, {
					primary: true,
					onClick: () => previewMut.mutate(),
					disabled: busy,
					"data-testid": "drive-preview-btn",
					children: i18nT("apps.awsControl.console.setup_preview_btn")
				}), preview && !confirmMut.isSuccess && /* @__PURE__ */ jsx(Btn, {
					primary: true,
					onClick: () => confirmMut.mutate(),
					disabled: busy,
					"data-testid": "drive-confirm-btn",
					children: confirmMut.isPending ? i18nT("apps.awsControl.console.setup_creating") : i18nT("apps.awsControl.console.setup_confirm_btn")
				})]
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: previewMut.error,
				message: previewMut.isError ? i18nT("apps.awsControl.console.setup_error") : null,
				className: "mt-2",
				testId: "drive-preview-error"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: confirmMut.error,
				message: confirmMut.isError ? i18nT("apps.awsControl.console.setup_confirm_error") : null,
				className: "mt-2",
				testId: "drive-confirm-error"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ jsxs(Btn, {
					onClick: () => setShowPolicy((v) => !v),
					"aria-expanded": showPolicy,
					"data-testid": "policy-toggle",
					children: [
						/* @__PURE__ */ jsx(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": "true"
						}),
						i18nT("apps.awsControl.console.setup_policy_label"),
						/* @__PURE__ */ jsx(ChevronDown, {
							className: `h-3.5 w-3.5 transition-transform ${showPolicy ? "rotate-180" : ""}`,
							"aria-hidden": "true"
						})
					]
				}), showPolicy && /* @__PURE__ */ jsxs("div", {
					className: "mt-2",
					"data-testid": "policy-drawer",
					children: [
						policyQ.isLoading && /* @__PURE__ */ jsx("div", {
							className: "text-[12px] text-muted",
							children: i18nT("apps.awsControl.console.loading")
						}),
						/* @__PURE__ */ jsx(AwsErrorNotice, {
							askAgent: true,
							error: policyQ.error,
							message: policyQ.isError ? i18nT("apps.awsControl.console.setup_policy_error") : null,
							onRetry: () => policyQ.refetch(),
							testId: "policy-error"
						}),
						policyQ.data && /* @__PURE__ */ jsxs("div", {
							className: "relative rounded-md border border-border bg-bg-elevated p-3",
							children: [/* @__PURE__ */ jsx("div", {
								className: "absolute right-2 top-2",
								children: /* @__PURE__ */ jsx(CopyBtn, {
									text: policyQ.data.policy,
									testId: "policy-copy"
								})
							}), /* @__PURE__ */ jsx("pre", {
								className: "max-h-64 overflow-auto whitespace-pre-wrap break-all pr-24 font-mono text-[11px] text-text",
								children: policyQ.data.policy
							})]
						})
					]
				})]
			})
		]
	});
}
/**
* Usage & costs for the selected account: the month-to-date bill, the storage
* meter split by drive section, and the paid-service consent receipts. This is
* a rail pane in `AwsControlPage`, not a page of its own — the per-account
* console this file used to export dissolved into the flat-rail layout, and
* this pane is where its money-shaped facts landed.
*/
function UsagePane({ account }) {
	const id = account.account;
	const qcTop = useQueryClient();
	const appKey = useAppQueryKey();
	const driveQ = useAppQuery(["drive", id], { queryFn: () => awsControlApi.drive(id) });
	const costsQ = useAppQuery(["costs", id], {
		queryFn: () => awsControlApi.costs(id),
		retry: 1
	});
	const drive = driveQ.data;
	const costs = costsQ.data;
	const driveErr = driveQ.error instanceof AwsControlError ? driveQ.error : null;
	const driveConsentRefused = driveQ.isError && driveErr?.status === 409 && driveErr.message === "aws_consent_required";
	const costsErr = costsQ.error instanceof AwsControlError ? costsQ.error : null;
	const costsFailed = costsQ.isError && costsErr?.message !== "aws_consent_required";
	const costsStale = Boolean(costs?.fetchError);
	const s3ConsentQ = useQuery({
		queryKey: ["awsConsent", "s3"],
		queryFn: () => api.awsConsent("s3")
	});
	const ceConsentQ = useQuery({
		queryKey: ["awsConsent", "ce"],
		queryFn: () => api.awsConsent("ce")
	});
	const confirmedHere = (c) => c?.granted === true && c.grant?.account === id;
	const s3Receipt = confirmedHere(s3ConsentQ.data) && !driveConsentRefused;
	const ceReceipt = confirmedHere(ceConsentQ.data) && !costs?.consentMissing;
	const ceAsk = ceConsentQ.data?.granted === false;
	const refetchGated = () => {
		qcTop.invalidateQueries({ queryKey: appKey(["drive", id]) });
		qcTop.invalidateQueries({ queryKey: appKey(["costs", id]) });
	};
	const costFigure = costs && !costs.consentMissing && !costsQ.isError;
	const mtdValue = costsQ.isLoading ? void 0 : costFigure ? fmtCurrency(costs.monthToDate, costs.currency) : "—";
	const storageValue = driveQ.isLoading ? void 0 : drive?.exists ? fmtBytes(drive.usage.bytes) : "—";
	const objectsValue = driveQ.isLoading ? void 0 : drive?.exists ? fmtNumber(drive.usage.objects) : "—";
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "usage-pane",
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(Wallet, { size: 18 }),
				title: i18nT("apps.awsControl.rail.usage")
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
				"data-testid": "console-stats",
				children: [
					/* @__PURE__ */ jsx(StatCard, {
						label: i18nT("apps.awsControl.console.stat_this_month"),
						value: mtdValue,
						accent: true,
						className: "tabular-nums",
						"data-testid": "console-cost-stat"
					}),
					/* @__PURE__ */ jsx(StatCard, {
						label: i18nT("apps.awsControl.console.stat_storage"),
						value: storageValue,
						className: "tabular-nums",
						"data-testid": "console-storage-stat"
					}),
					/* @__PURE__ */ jsx(StatCard, {
						label: i18nT("apps.awsControl.console.stat_objects"),
						value: objectsValue,
						className: "tabular-nums",
						"data-testid": "console-objects-stat"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mb-4 mt-1.5 min-h-[1.25rem] text-[12px] text-muted",
				children: [costs && costFigure && !costs.fresh && /* @__PURE__ */ jsx("span", { children: i18nT("apps.awsControl.console.costs_as_of", { date: fmtDate(costs.fetchedAt) }) }), costs?.consentMissing && /* @__PURE__ */ jsx("span", {
					"data-testid": "console-cost-reason",
					children: i18nT("apps.awsControl.console.costs_consent_missing")
				})]
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: costsQ.error,
				message: costsFailed ? i18nT("apps.awsControl.console.costs_unavailable") : costsStale ? i18nT("apps.awsControl.console.costs_refresh_failed") : null,
				onRetry: () => costsQ.refetch(),
				className: "mb-4",
				testId: "costs-error"
			}),
			driveQ.isLoading && /* @__PURE__ */ jsx(Skeleton, {
				className: "mb-4 h-[104px] rounded-lg",
				"data-testid": "usage-storage-skeleton"
			}),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: driveQ.error,
				message: driveQ.isError && !driveConsentRefused ? i18nT(driveErr?.status === 409 ? "apps.awsControl.console.account_unavailable" : "apps.awsControl.console.drive_status_failed") : null,
				onRetry: () => driveQ.refetch(),
				className: "mb-4",
				testId: "usage-drive-error"
			}),
			drive?.exists && /* @__PURE__ */ jsxs("div", {
				"data-testid": "usage-storage",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "mb-2 flex flex-wrap items-center gap-x-2 gap-y-1",
					children: [
						/* @__PURE__ */ jsx(HardDrive, {
							className: "h-3.5 w-3.5 shrink-0 text-accent",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-[13px] font-medium text-text-strong",
							children: i18nT("apps.awsControl.console.drive_title")
						}),
						/* @__PURE__ */ jsx("span", {
							className: "min-w-0 truncate font-mono text-[12px] text-muted",
							"data-testid": "drive-bucket",
							children: drive.bucket
						}),
						/* @__PURE__ */ jsx(CopyBtn, {
							text: drive.bucket,
							testId: "drive-copy-bucket"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-[12px] text-muted",
							children: drive.region
						})
					]
				}), /* @__PURE__ */ jsx(StorageMeter, { usage: drive.usage })]
			}),
			(s3Receipt || ceReceipt || ceAsk) && /* @__PURE__ */ jsxs(Card, {
				"data-testid": "paid-services",
				children: [/* @__PURE__ */ jsxs(CardTitle, { children: [/* @__PURE__ */ jsx(Receipt, {
					className: "h-3.5 w-3.5 shrink-0 text-accent",
					"aria-hidden": "true"
				}), i18nT("apps.awsControl.page.paid_services_title")] }), /* @__PURE__ */ jsxs("div", {
					className: "divide-y divide-border",
					children: [
						s3Receipt && /* @__PURE__ */ jsx(AwsConsentGate, {
							service: "s3",
							compact: true,
							onConsentChange: refetchGated,
							askAgent: true
						}),
						ceReceipt && /* @__PURE__ */ jsx(AwsConsentGate, {
							service: "ce",
							compact: true,
							onConsentChange: refetchGated,
							askAgent: true
						}),
						ceAsk && /* @__PURE__ */ jsx("div", {
							"data-testid": "costs-consent-gate",
							children: /* @__PURE__ */ jsx(AwsConsentGate, {
								service: "ce",
								compact: true,
								onConsentChange: refetchGated,
								askAgent: true
							})
						})
					]
				})]
			})
		]
	});
}
// src/AwsControlPage.tsx
/**
* AWS Control — the flat-rail shell.
*
* The drive IS the product, so its four sections (Files, Library, Backup,
* Share links) are the app's own first-level navigation, laid out as a rail
* beside the content pane. The account is a card at the top of that rail with
* a switcher; account management and the money facts sink to the rail's foot
* (Accounts & credentials, Usage & costs) the way settings do. Opening the app
* lands on Files — the most used surface — with no account picking in the way.
*
* Everything here is view state, not routes: `BuiltinAppRoute` resolves only
* single-segment routes, so the active pane and the selected account are this
* component's state. The selected account persists across visits so a
* single-account operator never sees a chooser.
*
* The surface stays read-only over accounts (spec §2.3): every mutation lives
* in the crew or a dashboard confirmation card. The only writes are the
* paid-service consent gates, which are their own durable-state components.
*/
/** Tailwind token for each health light, keyed as an `as const` map (literal-safe). */
var HEALTH_DOT = {
	ok: "bg-ok",
	degraded: "bg-warn",
	unknown: "bg-muted"
};
var HEALTH_LABEL_KEY = {
	ok: "apps.awsControl.page.health_ok",
	degraded: "apps.awsControl.page.health_degraded",
	unknown: "apps.awsControl.page.health_unknown"
};
/** Text tone for the health WORD, the same hue as its dot: one fact must not
*  read as two states (a grey dot beside an amber "Unknown"). */
var HEALTH_TEXT = {
	ok: "text-ok",
	degraded: "text-warn",
	unknown: "text-muted"
};
/** The name a row leads with: the backend name, or the "not connected" label. */
function accountName(account) {
	return account.name || i18nT("apps.awsControl.page.not_connected_yet");
}
var PANE_LABEL_KEY = {
	overview: "apps.awsControl.overview.title",
	files: "apps.awsControl.console.section_files",
	library: "apps.awsControl.console.section_library",
	backup: "apps.awsControl.console.section_backup",
	shares: "apps.awsControl.console.access_title",
	accounts: "apps.awsControl.rail.accounts",
	usage: "apps.awsControl.rail.usage"
};
var PANE_ICON = {
	overview: LayoutDashboard,
	files: FolderClosed,
	library: Library,
	backup: Archive,
	shares: Share2,
	accounts: Users,
	usage: Wallet
};
/** The rail's first group: the landing pane plus the four drive sections. */
var TOP_PANES = [
	"overview",
	"files",
	"library",
	"backup",
	"shares"
];
var FOOT_PANES = ["accounts", "usage"];
/** One rail navigation item: icon, label, and an optional count on the right. */
function RailItem({ pane, count, active, onClick }) {
	const Icon = PANE_ICON[pane];
	return /* @__PURE__ */ jsxs(ui_default$2, {
		onClick,
		"aria-current": active ? "page" : void 0,
		"data-testid": `rail-${pane}`,
		className: `flex w-full shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] cursor-pointer focus-ring md:shrink ${active ? "bg-accent-subtle font-medium text-text" : "text-text hover:bg-bg-hover"}`,
		children: [
			/* @__PURE__ */ jsx(Icon, {
				className: `h-4 w-4 shrink-0 ${active ? "text-accent" : "text-muted"}`,
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "min-w-0 flex-1 truncate",
				children: i18nT(PANE_LABEL_KEY[pane])
			}),
			count !== void 0 && /* @__PURE__ */ jsx("span", {
				className: "shrink-0 font-mono text-[12px] tabular-nums text-muted",
				"data-testid": `rail-${pane}-count`,
				children: fmtNumber(count)
			})
		]
	});
}
/**
* The account card at the rail's top: health dot, name, id, and a switcher.
*
* The dropdown lists every RESOLVED account — an unresolved profile has no
* account to select and is reached through Accounts & credentials, which is
* the menu's last item. With one account the card still renders (it is the
* pane's context, not a chooser), the menu just has one entry.
*/
function AccountSwitcher({ accounts, selected, onSelect, onManage }) {
	return /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
		asChild: true,
		children: /* @__PURE__ */ jsxs("button", {
			className: "mb-3 flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left cursor-pointer hover:bg-bg-hover focus-ring",
			"data-testid": "account-switcher",
			"aria-label": i18nT("apps.awsControl.rail.switch_account"),
			children: [
				/* @__PURE__ */ jsx("span", {
					className: `h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[selected.health]}`,
					"data-testid": "switcher-health",
					"data-health": selected.health,
					role: "img",
					"aria-label": i18nT(HEALTH_LABEL_KEY[selected.health])
				}),
				/* @__PURE__ */ jsxs("span", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ jsx("span", {
						className: "block truncate text-[13px] font-semibold text-text-strong",
						"data-testid": "switcher-name",
						children: accountName(selected)
					}), /* @__PURE__ */ jsx("span", {
						className: "block truncate font-mono text-[11px] text-muted",
						"data-testid": "switcher-id",
						children: selected.account
					})]
				}),
				/* @__PURE__ */ jsx(ChevronsUpDown, {
					size: 14,
					className: "shrink-0 text-muted",
					"aria-hidden": "true"
				})
			]
		})
	}), /* @__PURE__ */ jsxs(DropdownMenuContent, {
		align: "start",
		children: [accounts.map((a) => /* @__PURE__ */ jsxs(DropdownMenuItem, {
			onSelect: () => onSelect(a.account),
			"data-testid": "switcher-option",
			"data-account": a.account,
			children: [
				/* @__PURE__ */ jsx("span", {
					className: `h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[a.health]}`,
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ jsx("span", {
					className: "min-w-0 truncate",
					children: accountName(a)
				}),
				a.health !== "ok" && /* @__PURE__ */ jsx("span", {
					className: `shrink-0 text-[11px] ${HEALTH_TEXT[a.health]}`,
					"data-testid": "switcher-option-health",
					children: i18nT(HEALTH_LABEL_KEY[a.health])
				}),
				/* @__PURE__ */ jsx("span", {
					className: "font-mono text-[11px] text-muted",
					children: a.account
				}),
				a.account === selected.account && /* @__PURE__ */ jsx(Check, {
					size: 13,
					className: "text-accent",
					"aria-hidden": "true"
				})
			]
		}, a.account)), /* @__PURE__ */ jsxs(DropdownMenuItem, {
			onSelect: onManage,
			"data-testid": "switcher-manage",
			children: [/* @__PURE__ */ jsx(Users, {
				size: 13,
				"aria-hidden": "true"
			}), i18nT("apps.awsControl.rail.accounts")]
		})]
	})] });
}
/**
* One account row: a health dot, the account name, and under it the full
* 12-digit id with the account's region — then, on the right, the keys count,
* the health word when something is wrong, a Reconnect action for a failing
* connection, and an overflow menu.
*
* A resolved row SELECTS that account for the whole app (rail card, drive panes,
* usage). An UNRESOLVED row cannot be selected (there is no account behind it),
* so its click toggles the inline Reconnect guidance instead — a red row must
* always offer a way back to green. A DEGRADED row is resolved but has at least
* one dead key, so its click still selects and the guidance hangs off its own
* Reconnect button: before that button existed the amber row named the problem
* and offered nothing to do about it.
*
* Every row also carries an overflow menu whose one item removes the account
* from AWS Control: a registration must be reversible from the same surface
* that offered it, or a key added by mistake stays on the page for good.
* Removal is registry-only — it forgets the account's keys HERE and withdraws
* their paid-service consent, and changes nothing in AWS or in the operator's
* AWS CLI configuration — which the confirm strip states before the reader
* commits. The strip stays open until the request resolves because it is the
* only place the outcome can render.
*/
function AccountRow({ account, current, onUse, askAgent, variant = "pane" }) {
	const keys = account.profiles.length;
	const resolved = Boolean(account.account);
	const failing = account.profiles.find((p) => !p.identityOk) ?? account.profiles[0];
	const region = (account.profiles.find((p) => p.default) ?? account.profiles[0])?.region ?? "";
	const [showReconnect, setShowReconnect] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const removeM = useMutation({
		mutationFn: () => awsControlApi.unregisterProfiles(account.profiles.map((p) => p.name)),
		onSuccess: () => {
			setConfirming(false);
			qc.invalidateQueries({ queryKey: appKey(["accounts"]) });
			qc.invalidateQueries({ queryKey: appKey(["profiles-available"]) });
			qc.invalidateQueries({ queryKey: ["awsConsent"] });
		}
	});
	const confirmLabel = resolved ? i18nT("apps.awsControl.page.remove_account_confirm", { name: accountName(account) }) : i18nT("apps.awsControl.page.forget_key_confirm", { name: account.profiles.map((p) => p.name).join(", ") });
	const keysAt = account.health === "ok" ? "" : variant === "overview" ? "hidden" : "hidden sm:inline-flex";
	const needsAction = resolved && account.health !== "ok";
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-1.5 pr-1",
			children: [/* @__PURE__ */ jsxs("button", {
				onClick: resolved ? onUse : () => setShowReconnect((v) => !v),
				className: `flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-left cursor-pointer bg-transparent border-none hover:bg-bg-hover focus-ring ${variant === "overview" ? "py-2" : "py-2.5"}`,
				"data-testid": "account-card",
				"data-current": current || void 0,
				"aria-label": i18nT(resolved ? "apps.awsControl.rail.use_account" : "apps.awsControl.page.reconnect"),
				"aria-expanded": resolved ? void 0 : showReconnect,
				children: [
					/* @__PURE__ */ jsx("span", {
						className: `h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[account.health]}`,
						"data-testid": "health-dot",
						"data-health": account.health,
						role: "img",
						"aria-label": i18nT(HEALTH_LABEL_KEY[account.health])
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block truncate text-[13px] font-medium text-text-strong",
							"data-testid": "account-name",
							children: accountName(account)
						}), /* @__PURE__ */ jsxs("span", {
							className: "mt-0.5 flex items-center gap-1.5 text-[12px] text-muted",
							children: [account.account ? /* @__PURE__ */ jsx("span", {
								className: "min-w-0 truncate font-mono tabular-nums",
								"data-testid": "account-id",
								children: account.account
							}) : /* @__PURE__ */ jsx("span", {
								className: "min-w-0 truncate font-mono",
								"data-testid": "account-key-names",
								children: account.profiles.map((p) => p.name).join(", ")
							}), region && variant !== "overview" && /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: "hidden sm:inline",
								children: "·"
							}), /* @__PURE__ */ jsx("span", {
								className: "min-w-0 truncate hidden sm:inline",
								"data-testid": "account-region",
								children: region
							})] })]
						})]
					}),
					current ? /* @__PURE__ */ jsx(Check, {
						className: "h-3.5 w-3.5 shrink-0 text-accent",
						"aria-hidden": "true",
						"data-testid": "account-current"
					}) : !resolved ? /* @__PURE__ */ jsx(ChevronDown, {
						className: `h-3.5 w-3.5 shrink-0 text-muted transition-transform ${showReconnect ? "rotate-180" : ""}`,
						"aria-hidden": "true"
					}) : null
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: `flex shrink-0 items-center justify-end gap-1.5 ${needsAction ? variant === "overview" ? "basis-full" : "basis-full sm:basis-auto" : ""}`,
				children: [
					/* @__PURE__ */ jsxs(Badge, {
						variant: "muted",
						className: `shrink-0 ${keysAt}`,
						"data-testid": "account-keys",
						children: [/* @__PURE__ */ jsx(KeyRound, {
							className: "h-3 w-3",
							"aria-hidden": "true"
						}), i18nT("apps.awsControl.page.keys_summary", { count: keys })]
					}),
					account.health !== "ok" && /* @__PURE__ */ jsxs(Badge, {
						variant: account.health === "degraded" ? "warn" : "muted",
						className: "shrink-0",
						"data-testid": "account-health-word",
						children: [account.health === "degraded" && /* @__PURE__ */ jsx(TriangleAlert, {
							className: "h-3 w-3",
							"aria-hidden": "true"
						}), i18nT(HEALTH_LABEL_KEY[account.health])]
					}),
					/* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
						asChild: true,
						children: /* @__PURE__ */ jsx(IconButton, {
							"aria-label": i18nT("apps.awsControl.page.account_actions"),
							className: "shrink-0 text-muted",
							"data-testid": "account-more",
							children: /* @__PURE__ */ jsx(MoreHorizontal, { className: "h-3.5 w-3.5" })
						})
					}), /* @__PURE__ */ jsxs(DropdownMenuContent, {
						align: "end",
						children: [needsAction && failing && /* @__PURE__ */ jsxs(DropdownMenuItem, {
							onSelect: () => setShowReconnect((v) => !v),
							"data-testid": "account-reconnect",
							children: [/* @__PURE__ */ jsx(RefreshCw, {
								size: 13,
								className: "shrink-0"
							}), i18nT("apps.awsControl.page.reconnect")]
						}), /* @__PURE__ */ jsxs(DropdownMenuItem, {
							onSelect: () => setConfirming(true),
							className: "items-start",
							"data-testid": "account-remove",
							children: [/* @__PURE__ */ jsx(Trash2, {
								size: 13,
								className: "mt-0.5 shrink-0"
							}), /* @__PURE__ */ jsxs("span", {
								className: "flex min-w-0 flex-col",
								children: [/* @__PURE__ */ jsx("span", { children: i18nT("apps.awsControl.page.remove_account") }), /* @__PURE__ */ jsx("span", {
									className: "text-[12px] text-muted",
									"data-testid": "account-remove-hint",
									children: i18nT("apps.awsControl.page.remove_account_hint")
								})]
							})]
						})]
					})] })
				]
			})]
		}),
		confirming && /* @__PURE__ */ jsx("div", {
			className: "px-3 pb-2",
			children: /* @__PURE__ */ jsx(TileConfirm, {
				testId: "account-remove-confirm",
				label: confirmLabel,
				action: i18nT(resolved ? "apps.awsControl.page.remove_account_action" : "apps.awsControl.page.forget_key_action"),
				error: removeM.isError ? i18nT("apps.awsControl.page.remove_account_error") : "",
				errorSource: removeM.error ?? void 0,
				askAgent,
				pending: removeM.isPending,
				onCancel: () => {
					setConfirming(false);
					removeM.reset();
				},
				onConfirm: () => removeM.mutate()
			})
		}),
		showReconnect && failing && /* @__PURE__ */ jsx("div", {
			className: "px-3 pb-2",
			"data-testid": "row-reconnect",
			children: /* @__PURE__ */ jsx(ReconnectAction, {
				profile: failing,
				askAgent
			})
		})
	] });
}
/**
* An "Add accounts" disclosure: lists the LOCAL profiles the CLI knows but the
* portal has not registered, each with a checkbox, and registers the checked
* set. It stays collapsed by default so the account list remains the pane's
* primary content — except when that list is EMPTY: then this disclosure is
* the pane's only useful action, and the empty state above it points here, so
* it opens itself rather than making a first-run reader find a chevron. On
* success it invalidates the accounts query so a newly registered profile
* appears without a manual refresh.
*/
function AddAccounts({ onDraftChange, autoOpen = false }) {
	const queryClient = useQueryClient();
	const appKey = useAppQueryKey();
	const [open, setOpen] = useState(autoOpen);
	useEffect(() => {
		if (autoOpen) setOpen(true);
	}, [autoOpen]);
	const [checked, setChecked] = useState(/* @__PURE__ */ new Set());
	const hasDraft = checked.size > 0;
	useEffect(() => {
		onDraftChange(hasDraft);
	}, [hasDraft, onDraftChange]);
	const [query, setQuery] = useState("");
	const availableQ = useAvailableProfilesQuery();
	const registerM = useMutation({
		mutationFn: (names) => awsControlApi.registerProfiles(names),
		onSuccess: (_result, names) => {
			queryClient.invalidateQueries({ queryKey: appKey(["accounts"]) });
			queryClient.invalidateQueries({ queryKey: appKey(["profiles-available"]) });
			setChecked((prev) => {
				const kept = new Set([...prev].filter((name) => !names.includes(name)));
				return kept.size === prev.size ? prev : kept;
			});
		}
	});
	const data = availableQ.data;
	const unregistered = useMemo(() => (data?.profiles ?? []).filter((p) => !p.registered), [data]);
	const trimmed = query.trim();
	const needle = trimmed.toLowerCase();
	const visible = useMemo(() => {
		if (!needle) return unregistered;
		return unregistered.filter((p) => p.name.toLowerCase().includes(needle) || checked.has(p.name));
	}, [
		unregistered,
		needle,
		checked
	]);
	const keepsSelected = needle.length > 0 && visible.some((p) => !p.name.toLowerCase().includes(needle));
	const capReached = data ? data.registeredCount >= data.max : false;
	const canRegister = checked.size > 0 && !capReached && !registerM.isPending;
	const toggle = (name) => setChecked((prev) => {
		const next = new Set(prev);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		return next;
	});
	if (data && !data.supported) return /* @__PURE__ */ jsxs("section", {
		className: "mt-8",
		"data-testid": "add-accounts",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "text-sm font-semibold text-text-strong",
			children: i18nT("apps.awsControl.page.add_accounts_title")
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-1 text-[13px] text-muted",
			"data-testid": "add-accounts-unsupported",
			children: i18nT("apps.awsControl.page.add_accounts_unsupported")
		})]
	});
	return /* @__PURE__ */ jsxs("section", {
		className: "mt-8",
		"data-testid": "add-accounts",
		children: [/* @__PURE__ */ jsxs(ui_default$2, {
			onClick: () => setOpen((v) => !v),
			className: "flex w-full items-center gap-2 rounded-md p-0 text-left cursor-pointer focus-ring",
			"data-testid": "add-accounts-toggle",
			"aria-expanded": open,
			children: [
				/* @__PURE__ */ jsx(ChevronDown, {
					className: `h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "" : "-rotate-90"}`,
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ jsx("span", {
					className: "text-sm font-semibold text-text-strong",
					children: i18nT("apps.awsControl.page.add_accounts_title")
				}),
				/* @__PURE__ */ jsx("span", {
					className: "text-[12px] text-muted",
					children: i18nT("apps.awsControl.page.add_accounts_summary")
				})
			]
		}), open && /* @__PURE__ */ jsxs("div", {
			className: "mt-3",
			"data-testid": "add-accounts-body",
			children: [
				/* @__PURE__ */ jsx(AwsErrorNotice, {
					askAgent: !hasDraft,
					error: availableQ.error,
					message: availableQ.isError ? i18nT("apps.awsControl.page.add_accounts_load_error") : null,
					onRetry: () => availableQ.refetch(),
					className: "mb-2",
					testId: "add-accounts-load-error"
				}),
				data && /* @__PURE__ */ jsx("p", {
					className: "mb-2 text-[12px] text-muted",
					"data-testid": "add-accounts-count",
					children: i18nT("apps.awsControl.page.add_accounts_count", {
						count: data.registeredCount,
						max: data.max
					})
				}),
				availableQ.isError || !data ? null : data.profiles.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "text-[13px] text-muted",
					"data-testid": "add-accounts-no-profiles",
					children: i18nT("apps.awsControl.page.add_accounts_no_profiles")
				}) : unregistered.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "text-[13px] text-muted",
					"data-testid": "add-accounts-none",
					children: i18nT("apps.awsControl.page.add_accounts_none")
				}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
					/* @__PURE__ */ jsx("p", {
						className: "mb-2 text-[13px] text-muted",
						children: i18nT("apps.awsControl.page.add_accounts_intro")
					}),
					/* @__PURE__ */ jsx(SearchInput, {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: i18nT("apps.awsControl.page.add_accounts_search_placeholder"),
						"aria-label": i18nT("apps.awsControl.page.add_accounts_search_placeholder"),
						className: "mb-2 w-full sm:w-64",
						"data-testid": "add-accounts-search"
					}),
					keepsSelected && /* @__PURE__ */ jsx("p", {
						className: "mb-2 text-[12px] text-muted",
						"data-testid": "add-accounts-kept-selected",
						children: i18nT("apps.awsControl.page.add_accounts_search_keeps_selected")
					}),
					visible.length === 0 ? /* @__PURE__ */ jsx(FilteredEmpty, {
						query: trimmed,
						onClear: () => setQuery(""),
						testId: "add-accounts-search-empty"
					}) : /* @__PURE__ */ jsx("ul", {
						className: "flex flex-col gap-1",
						"data-testid": "add-accounts-list",
						children: visible.map((p) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("label", {
							className: "flex items-center gap-2 text-[13px] text-text-strong cursor-pointer",
							children: [/* @__PURE__ */ jsx(Checkbox, {
								checked: checked.has(p.name),
								onChange: () => toggle(p.name),
								"aria-label": p.name,
								"data-testid": "add-accounts-checkbox",
								"data-name": p.name
							}), /* @__PURE__ */ jsx("span", {
								className: "font-mono",
								children: p.name
							})]
						}) }, p.name))
					}),
					capReached && /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-[12px] text-warn",
						"data-testid": "add-accounts-cap",
						children: i18nT("apps.awsControl.page.add_accounts_cap_reached", { max: data?.max ?? 0 })
					}),
					/* @__PURE__ */ jsx(AwsErrorNotice, {
						error: registerM.error,
						message: registerM.isError ? i18nT("apps.awsControl.page.add_accounts_error") : null,
						className: "mt-2",
						testId: "add-accounts-error"
					}),
					/* @__PURE__ */ jsx(Btn, {
						onClick: () => registerM.mutate([...checked]),
						disabled: !canRegister,
						primary: true,
						className: "mt-3",
						"data-testid": "add-accounts-register",
						children: registerM.isPending ? i18nT("apps.awsControl.page.add_accounts_registering") : i18nT("apps.awsControl.page.add_accounts_register")
					})
				] })
			]
		})]
	});
}
/**
* The Accounts & credentials pane: every registered account as a selectable
* row with a client-side search, the selected account's connection keys, the
* orphaned-consent rescue, and the Add-accounts disclosure.
*/
function AccountsPane({ accountsQ, selected, onUse, openAddAccounts = false }) {
	const [query, setQuery] = useState("");
	const data = accountsQ.data;
	const refreshAccounts = useRefreshAccounts();
	const [registrationDraft, setRegistrationDraft] = useState(false);
	const handOff = !registrationDraft;
	const canAddHere = useAvailableProfilesQuery().data?.supported !== false;
	const filtered = useMemo(() => {
		const rows = data?.accounts ?? [];
		const q = query.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((a) => a.account.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
	}, [data, query]);
	const s3ConsentQ = useQuery({
		queryKey: ["awsConsent", "s3"],
		queryFn: () => api.awsConsent("s3")
	});
	const ceConsentQ = useQuery({
		queryKey: ["awsConsent", "ce"],
		queryFn: () => api.awsConsent("ce")
	});
	const orphaned = (c) => {
		const owner = c?.grant?.account;
		if (c?.granted !== true || !owner) return false;
		if (!accountsQ.isSuccess) return false;
		return !(data?.accounts ?? []).some((a) => a.account === owner);
	};
	const s3Orphan = orphaned(s3ConsentQ.data);
	const ceOrphan = orphaned(ceConsentQ.data);
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "accounts-pane",
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(Users, { className: "h-[18px] w-[18px]" }),
				title: i18nT("apps.awsControl.rail.accounts"),
				subtitle: data?.totals ? /* @__PURE__ */ jsx("span", {
					"data-testid": "accounts-totals",
					children: i18nT("apps.awsControl.page.totals_summary", {
						count: data.accounts.length,
						accounts: fmtNumber(data.accounts.length),
						keys: i18nT("apps.awsControl.page.keys_healthy", {
							count: data.totals.profiles,
							n: fmtNumber(data.totals.profiles),
							healthy: fmtNumber(data.totals.profilesHealthy)
						})
					})
				}) : void 0,
				actions: /* @__PURE__ */ jsxs(Btn, {
					onClick: () => void refreshAccounts(),
					disabled: accountsQ.isFetching,
					"data-testid": "refresh",
					children: [/* @__PURE__ */ jsx(RefreshCw, { className: `h-3.5 w-3.5 ${accountsQ.isFetching ? "animate-spin" : ""}` }), i18nT("apps.awsControl.page.refresh")]
				})
			}),
			accountsQ.isLoading && /* @__PURE__ */ jsxs(Card, {
				className: "px-2 py-4 md:px-4",
				"data-testid": "accounts-loading",
				children: [/* @__PURE__ */ jsx(PanelSectionHeader, {
					label: i18nT("apps.awsControl.overview.accounts_title"),
					className: "mb-2 px-1"
				}), /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-border",
					children: [
						0,
						1,
						2
					].map((i) => /* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3 px-3 py-2.5",
						children: [
							/* @__PURE__ */ jsx(Skeleton, { className: "h-2 w-2 rounded-full" }),
							/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-32" }), /* @__PURE__ */ jsx(Skeleton, { className: "mt-1.5 h-3 w-40" })]
							}),
							/* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-16 rounded-full" })
						]
					}, i))
				})]
			}),
			data && data.accounts.length === 0 && /* @__PURE__ */ jsx("div", {
				"data-testid": "accounts-empty",
				children: /* @__PURE__ */ jsx(EmptyState, {
					testId: "aws-control-empty",
					icon: /* @__PURE__ */ jsx(Cloud, {}),
					title: i18nT("apps.awsControl.page.empty_title"),
					subtitle: canAddHere ? i18nT("apps.awsControl.page.empty_body") : void 0
				})
			}),
			data && data.accounts.length > 0 && /* @__PURE__ */ jsxs(Card, {
				className: "px-2 py-4 md:px-4",
				"data-testid": "accounts-card",
				children: [/* @__PURE__ */ jsx(PanelSectionHeader, {
					label: i18nT("apps.awsControl.overview.accounts_title"),
					count: data.accounts.length,
					className: "mb-2 px-1",
					trailing: /* @__PURE__ */ jsx(SearchInput, {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: i18nT("apps.awsControl.page.search_placeholder"),
						"aria-label": i18nT("apps.awsControl.page.search_placeholder"),
						className: "w-32 sm:w-48",
						"data-testid": "accounts-search"
					})
				}), filtered.length > 0 ? /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-border",
					"data-testid": "accounts-list",
					children: filtered.map((a, i) => /* @__PURE__ */ jsx(AccountRow, {
						account: a,
						current: Boolean(selected && a.account === selected.account),
						onUse: () => onUse(a),
						askAgent: handOff
					}, a.account || `unresolved-${i}`))
				}) : /* @__PURE__ */ jsx(FilteredEmpty, {
					query: query.trim(),
					onClear: () => setQuery(""),
					testId: "accounts-search-empty"
				})]
			}),
			selected && /* @__PURE__ */ jsx("div", {
				className: "mt-8",
				"data-testid": "accounts-connections",
				children: /* @__PURE__ */ jsx(ConnectionsSection, {
					account: selected,
					askAgent: handOff
				})
			}),
			(s3Orphan || ceOrphan) && /* @__PURE__ */ jsxs("div", {
				className: "mt-6 flex flex-col gap-3",
				"data-testid": "orphan-consent",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-text",
						"data-testid": "orphan-consent-note",
						children: i18nT("apps.awsControl.page.orphan_consent")
					}),
					s3Orphan && /* @__PURE__ */ jsx(AwsConsentGate, {
						service: "s3",
						askAgent: handOff
					}),
					ceOrphan && /* @__PURE__ */ jsx(AwsConsentGate, {
						service: "ce",
						askAgent: handOff
					})
				]
			}),
			/* @__PURE__ */ jsx(AddAccounts, {
				onDraftChange: setRegistrationDraft,
				autoOpen: openAddAccounts || Boolean(data && data.accounts.length === 0)
			})
		]
	});
}
/**
* The app's landing pane: what is connected, what it costs, and what needs
* attention — read-only, on one screen.
*
* It exists because the rail's panes each answer ONE question and the app had no
* surface that answered "is everything fine": an operator landing on Files could
* not see that a second account had gone amber, that a share link expires
* tomorrow, or that the month-to-date figure had stopped being read. Every
* number here is a fact one of the panes already owns, restated once at a
* glance; the pane that can act on it is one rail click away, so this pane adds
* no mutation of its own beyond the two paid-service gates, which are the one
* decision that has nowhere else to live at this level.
*
* A read that FAILS says so: each of the pane's own reads (drive, bill, share
* links, backup schedule) renders an `AwsErrorNotice` with a retry when it
* errors, and its card holds a dash rather than an empty state — a 5xx shown as
* "no drive" or "$0" would be the pane lying about the one thing it exists to
* answer.
*/
/** The rail pane that owns each drive section, for the Overview's tiles. */
var SECTION_PANE = {
	drive: "files",
	library: "library",
	backup: "backup"
};
function OverviewPane({ accountsQ, selected, drive, driveQ, sharesQ, onUse, onOpenPane, onAddAccount }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const refreshAccounts = useRefreshAccounts();
	const id = selected.account;
	const data = accountsQ.data;
	const accounts = data?.accounts ?? [];
	const attention = accounts.filter((a) => a.health === "degraded").length;
	const live = drive?.exists ? drive : null;
	const driveErr = driveQ.error instanceof AwsControlError ? driveQ.error : null;
	const driveNeedsConsent = driveErr?.status === 409 && driveErr.message === "aws_consent_required";
	const driveFailed = driveQ.isError && !driveNeedsConsent;
	const costsQ = useAppQuery(["costs", id], {
		queryFn: () => awsControlApi.costs(id),
		retry: 1
	});
	const backupQ = useAppQuery([
		"backup",
		id,
		false
	], {
		queryFn: () => awsControlApi.backup(id, { remote: false }),
		enabled: Boolean(live)
	});
	const costs = costsQ.data;
	const costsErr = costsQ.error instanceof AwsControlError ? costsQ.error : null;
	const spendNeedsConsent = Boolean(costs?.consentMissing) || costsErr?.status === 409 && costsErr.message === "aws_consent_required";
	const costsFailed = costsQ.isError && !spendNeedsConsent;
	const costsStale = Boolean(costs?.fetchError);
	const spend = spendNeedsConsent || costsFailed ? "—" : costs ? fmtCurrency(costs.monthToDate, costs.currency) : void 0;
	const spendSub = spendNeedsConsent ? i18nT("apps.awsControl.overview.stat_spend_consent") : costs && !costsFailed ? i18nT("apps.awsControl.overview.stat_spend_scope") : void 0;
	const shares = sharesQ.data?.shares.length;
	const nightly = backupQ.data?.nightly;
	/** Everything this pane reads, re-read at once. */
	const refreshAll = () => {
		refreshAccounts();
		qc.invalidateQueries({ queryKey: appKey(["drive", id]) });
		qc.invalidateQueries({ queryKey: appKey(["costs", id]) });
		qc.invalidateQueries({ queryKey: appKey(["shares", id]) });
		qc.invalidateQueries({ queryKey: appKey(["backup", id]) });
	};
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "overview-pane",
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(LayoutDashboard, { className: "h-[18px] w-[18px]" }),
				title: i18nT("apps.awsControl.overview.title"),
				subtitle: i18nT("apps.awsControl.overview.subtitle"),
				actions: /* @__PURE__ */ jsxs(Btn, {
					onClick: refreshAll,
					disabled: accountsQ.isFetching,
					"data-testid": "refresh",
					children: [/* @__PURE__ */ jsx(RefreshCw, { className: `h-3.5 w-3.5 ${accountsQ.isFetching ? "animate-spin" : ""}` }), i18nT("apps.awsControl.page.refresh")]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6",
				"data-testid": "overview-stats",
				children: [
					/* @__PURE__ */ jsx(MetricCard, {
						testId: "overview-stat-accounts",
						onClick: () => onOpenPane("accounts"),
						label: i18nT("apps.awsControl.overview.stat_accounts"),
						value: data ? fmtNumber(accounts.length) : void 0,
						sub: data ? attention > 0 ? i18nT("apps.awsControl.overview.stat_accounts_attention", { count: attention }) : accounts.every((a) => a.health === "ok") ? i18nT("apps.awsControl.overview.stat_accounts_all_ok") : void 0 : void 0,
						delay: 0
					}),
					/* @__PURE__ */ jsx(MetricCard, {
						testId: "overview-stat-keys",
						onClick: () => onOpenPane("accounts"),
						label: i18nT("apps.awsControl.overview.stat_keys"),
						value: data?.totals ? `${fmtNumber(data.totals.profilesHealthy)}/${fmtNumber(data.totals.profiles)}` : void 0,
						sub: data?.totals ? i18nT("apps.awsControl.overview.stat_keys_sub", { count: data.totals.profiles }) : void 0,
						delay: 60
					}),
					/* @__PURE__ */ jsx(MetricCard, {
						testId: "overview-stat-drive",
						onClick: () => onOpenPane("files"),
						label: i18nT("apps.awsControl.overview.stat_drive"),
						value: live ? fmtBytes(live.usage.bytes) : driveQ.isLoading ? void 0 : "—",
						sub: live ? i18nT("apps.awsControl.console.root_section_objects", {
							count: live.usage.objects,
							objects: fmtNumber(live.usage.objects)
						}) : driveQ.isLoading || driveFailed ? void 0 : i18nT("apps.awsControl.overview.stat_drive_none"),
						delay: 120
					}),
					/* @__PURE__ */ jsx(MetricCard, {
						testId: "overview-stat-spend",
						onClick: () => onOpenPane("usage"),
						label: i18nT("apps.awsControl.overview.stat_spend"),
						value: spend,
						sub: spendSub,
						delay: 180
					}),
					/* @__PURE__ */ jsx(MetricCard, {
						testId: "overview-stat-shares",
						onClick: () => onOpenPane("shares"),
						label: i18nT("apps.awsControl.console.access_title"),
						value: sharesQ.isError ? "—" : shares === void 0 ? void 0 : fmtNumber(shares),
						sub: sharesQ.isError || shares === void 0 ? void 0 : shares === 0 ? i18nT("apps.awsControl.overview.stat_shares_none") : i18nT("apps.awsControl.overview.stat_shares_sub", { count: shares }),
						delay: 240
					}),
					/* @__PURE__ */ jsx(MetricCard, {
						testId: "overview-stat-backups",
						onClick: () => onOpenPane("backup"),
						label: i18nT("apps.awsControl.console.section_backup"),
						value: backupQ.isError ? "—" : nightly === void 0 ? live ? void 0 : "—" : nightly ? i18nT("apps.awsControl.overview.stat_backups_nightly") : i18nT("apps.awsControl.overview.stat_backups_manual"),
						accent: nightly === true,
						sub: backupQ.isError ? void 0 : nightly === void 0 ? live ? void 0 : i18nT("apps.awsControl.overview.stat_drive_none") : i18nT(nightly ? "apps.awsControl.overview.stat_backups_sub_nightly" : "apps.awsControl.overview.stat_backups_sub_manual"),
						delay: 300
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex flex-col gap-2",
				children: [
					/* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent: true,
						error: costsQ.error,
						message: costsFailed ? i18nT("apps.awsControl.console.costs_unavailable") : costsStale ? i18nT("apps.awsControl.console.costs_refresh_failed") : null,
						onRetry: () => qc.invalidateQueries({ queryKey: appKey(["costs", id]) }),
						testId: "overview-costs-error"
					}),
					/* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent: true,
						error: sharesQ.error,
						message: sharesQ.isError ? i18nT("apps.awsControl.console.access_list_failed") : null,
						onRetry: () => qc.invalidateQueries({ queryKey: appKey(["shares", id]) }),
						testId: "overview-shares-error"
					}),
					/* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent: true,
						error: backupQ.error,
						message: backupQ.isError ? i18nT("apps.awsControl.console.backup_status_failed") : null,
						onRetry: () => qc.invalidateQueries({ queryKey: appKey(["backup", id]) }),
						testId: "overview-backup-error"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ jsxs(Card, {
					className: "px-2 py-4 md:px-4",
					"data-testid": "overview-accounts",
					children: [
						/* @__PURE__ */ jsx(PanelSectionHeader, {
							label: i18nT("apps.awsControl.overview.accounts_title"),
							count: accounts.length,
							className: "mb-2 px-1",
							trailing: /* @__PURE__ */ jsxs(Btn, {
								onClick: onAddAccount,
								"data-testid": "overview-add-account",
								children: [/* @__PURE__ */ jsx(Plus, { className: "h-3.5 w-3.5" }), i18nT("apps.awsControl.overview.add_account")]
							})
						}),
						/* @__PURE__ */ jsx("div", {
							className: "divide-y divide-border",
							children: accounts.map((a, i) => /* @__PURE__ */ jsx(AccountRow, {
								account: a,
								current: a.account === selected.account,
								onUse: () => onUse(a),
								variant: "overview",
								askAgent: true
							}, a.account || `unresolved-${i}`))
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-3 px-1 text-[12px] leading-relaxed text-muted",
							"data-testid": "overview-accounts-note",
							children: i18nT("apps.awsControl.overview.accounts_note")
						})
					]
				}), /* @__PURE__ */ jsxs(Card, {
					className: "px-2 py-4 md:px-4",
					"data-testid": "overview-drive",
					children: [/* @__PURE__ */ jsxs(CardTitle, { children: [/* @__PURE__ */ jsx(Cloud, {
						className: "h-4 w-4 text-accent",
						"aria-hidden": "true"
					}), i18nT("apps.awsControl.overview.drive_title")] }), live ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
						/* @__PURE__ */ jsx("div", {
							className: "mt-3 px-1",
							children: /* @__PURE__ */ jsx(StorageBar, {
								usage: live.usage,
								testId: "overview-storage"
							})
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-4 grid grid-cols-1 gap-2 px-1 sm:grid-cols-3",
							children: SECTION_TILES.map(({ section, icon: Icon, labelKey }) => /* @__PURE__ */ jsx(QuickTile, {
								testId: `overview-tile-${section}`,
								onClick: () => onOpenPane(SECTION_PANE[section]),
								icon: /* @__PURE__ */ jsx(Icon, {
									className: "h-4 w-4",
									"aria-hidden": "true"
								}),
								label: i18nT(labelKey),
								count: i18nT("apps.awsControl.console.root_section_objects", {
									count: live.usage.sections[section].objects,
									objects: fmtNumber(live.usage.sections[section].objects)
								})
							}, section))
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "mt-3 flex flex-wrap items-baseline gap-x-2 px-1 text-[12px] leading-relaxed text-muted",
							children: [
								/* @__PURE__ */ jsx("span", { children: i18nT("apps.awsControl.overview.drive_bucket_label") }),
								/* @__PURE__ */ jsx("span", {
									className: "break-all font-mono text-text",
									"data-testid": "overview-drive-bucket",
									children: live.bucket
								}),
								/* @__PURE__ */ jsx("span", {
									className: "font-mono",
									"data-testid": "overview-drive-region",
									children: live.region
								})
							]
						})
					] }) : driveQ.isLoading ? /* @__PURE__ */ jsxs("div", {
						className: "px-1",
						"data-testid": "overview-drive-loading",
						children: [/* @__PURE__ */ jsx(Skeleton, { className: "mt-3 h-1.5 w-full rounded-full" }), /* @__PURE__ */ jsx("div", {
							className: "mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3",
							children: SECTION_TILES.map(({ section }) => /* @__PURE__ */ jsx(Skeleton, { className: "h-16 rounded-lg" }, section))
						})]
					}) : driveFailed ? /* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent: true,
						error: driveQ.error,
						message: i18nT(driveErr?.status === 409 ? "apps.awsControl.console.account_unavailable" : "apps.awsControl.console.drive_status_failed"),
						onRetry: () => qc.invalidateQueries({ queryKey: appKey(["drive", id]) }),
						testId: "overview-drive-error",
						className: "mx-1"
					}) : /* @__PURE__ */ jsx(EmptyState, {
						testId: "overview-drive-empty",
						icon: /* @__PURE__ */ jsx(Cloud, {}),
						title: i18nT("apps.awsControl.overview.drive_empty_title"),
						subtitle: i18nT("apps.awsControl.overview.drive_empty_body"),
						action: /* @__PURE__ */ jsxs(Btn, {
							primary: true,
							onClick: () => onOpenPane("files"),
							"data-testid": "overview-drive-setup",
							children: [/* @__PURE__ */ jsx(Cloud, { className: "h-3.5 w-3.5" }), i18nT("apps.awsControl.overview.drive_setup")]
						})
					})]
				})]
			}),
			/* @__PURE__ */ jsxs(Card, {
				className: "px-2 py-4 md:px-4",
				"data-testid": "overview-paid-services",
				children: [/* @__PURE__ */ jsx(PanelSectionHeader, {
					label: i18nT("apps.awsControl.page.paid_services_title"),
					count: 2,
					className: "mb-2 px-1"
				}), /* @__PURE__ */ jsxs("div", {
					className: "divide-y divide-border",
					children: [/* @__PURE__ */ jsx(AwsConsentGate, {
						service: "s3",
						compact: true,
						askAgent: true,
						onConsentChange: () => qc.invalidateQueries({ queryKey: appKey(["drive", id]) })
					}), /* @__PURE__ */ jsx(AwsConsentGate, {
						service: "ce",
						compact: true,
						askAgent: true,
						onConsentChange: () => qc.invalidateQueries({ queryKey: appKey(["costs", id]) })
					})]
				})]
			})
		]
	});
}
/** The accounts query, named so `AccountsPane` can type its prop off it. */
function useAccountsQuery() {
	return useAppQuery(["accounts"], { queryFn: () => awsControlApi.accounts() });
}
/**
* What the Refresh buttons run. A plain read is answered from the backend's
* five-minute probe snapshot; `?refresh=1` re-probes every key. It writes the
* list's own cache entry, so every reader repaints and `isFetching` drives the
* spinner. `staleTime: 0` because the client's default (`Infinity`) would answer
* from the cache without a request.
*/
function useRefreshAccounts() {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	return () => qc.prefetchQuery({
		queryKey: appKey(["accounts"]),
		queryFn: () => awsControlApi.accounts(true),
		staleTime: 0
	});
}
/**
* The local-profile scan, shared by the Add-accounts disclosure and by the
* accounts empty state.
*
* One hook rather than a `useQuery` at each site, because the two have to agree
* about `supported`: the empty state's copy names an action whose ONLY home is
* that disclosure, so an empty state that names it while the disclosure reports
* the platform cannot serve it is a promise the next paragraph refuses. Sharing
* the key already shares React Query's cache entry, so the second reader costs
* no request.
*/
function useAvailableProfilesQuery() {
	return useAppQuery(["profiles-available"], { queryFn: () => awsControlApi.availableProfiles() });
}
/**
* A drive-backed pane, gated on the drive actually existing.
*
* Loading skeletons, the storage-consent ask (a 409 whose fix is right here),
* the dead-connection notice, and the setup card all render under the pane's
* own title, so the rail selection and the pane header always agree about
* where the reader is even when the drive is not there yet.
*/
function DrivePaneGate({ pane, account, drive, driveQ, children }) {
	const qc = useQueryClient();
	const appKey = useAppQueryKey();
	const id = account.account;
	const Icon = PANE_ICON[pane];
	const driveErr = driveQ.error instanceof AwsControlError ? driveQ.error : null;
	const drive409 = driveQ.isError && driveErr?.status === 409 ? driveErr : null;
	const driveConsentRefused = drive409?.message === "aws_consent_required";
	const setupRegion = (account.profiles.find((p) => p.default) ?? account.profiles[0])?.region ?? "";
	if (drive?.exists) return /* @__PURE__ */ jsx(Fragment$1, { children: children(drive.bucket) });
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": `gate-${pane}`,
		children: [
			/* @__PURE__ */ jsx(PaneHeader, {
				icon: /* @__PURE__ */ jsx(Icon, { size: 18 }),
				title: i18nT(PANE_LABEL_KEY[pane])
			}),
			driveQ.isLoading && /* @__PURE__ */ jsx(ContentSkeleton, { rows: 3 }),
			drive409 && (driveConsentRefused ? /* @__PURE__ */ jsxs("div", {
				"data-testid": "console-storage-consent",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "mb-2 text-[13px] text-muted",
						children: i18nT("apps.awsControl.console.storage_consent_needed")
					}),
					/* @__PURE__ */ jsx(AwsConsentGate, {
						askAgent: true,
						service: "s3",
						onConsentChange: () => qc.invalidateQueries({ queryKey: appKey(["drive", id]) })
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-2",
						children: /* @__PURE__ */ jsxs(Btn, {
							onClick: () => qc.invalidateQueries({ queryKey: appKey(["drive", id]) }),
							"data-testid": "console-consent-recheck",
							children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("apps.awsControl.page.refresh")]
						})
					})
				]
			}) : /* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: driveErr,
				message: i18nT("apps.awsControl.console.account_unavailable"),
				testId: "console-unavailable"
			})),
			/* @__PURE__ */ jsx(AwsErrorNotice, {
				askAgent: true,
				error: driveQ.error,
				message: driveQ.isError && !drive409 ? i18nT("apps.awsControl.console.drive_status_failed") : null,
				onRetry: () => qc.invalidateQueries({ queryKey: appKey(["drive", id]) }),
				testId: "drive-status-error"
			}),
			drive && !drive.exists && /* @__PURE__ */ jsx("div", {
				"data-testid": "capability-drive-setup",
				children: /* @__PURE__ */ jsx(SetupCard, {
					account: id,
					region: setupRegion,
					searchedRegion: drive.searched_region
				})
			})
		]
	});
}
/** The app's own base path; pane routes hang off it (/aws-control/usage). */
var APP_PATH = "/aws-control";
var ALL_PANES = [...TOP_PANES, ...FOOT_PANES];
/**
* The pane the app lands on with no segment in the path: the read-only room that
* answers "is everything fine" before the reader has to pick a question.
*/
var DEFAULT_PANE = "overview";
/**
* Router state key that asks the accounts pane to arrive with its Add-accounts
* disclosure open. Carried on the navigation rather than held in the shell, so
* the request expires with the next navigation instead of re-opening the
* disclosure every later visit.
*/
var ADD_ACCOUNTS_STATE = "awsControlAddAccounts";
/**
* The pane named by the URL, or null on the bare app path.
*
* Read synchronously from the path (never normalized through an effect, which
* would render the wrong pane for a frame before correcting itself), through
* the SAME positional parser the settings path-nav uses — it already pins the
* trailing-slash and empty-segment behavior (an empty segment stays in place
* and matches no key) and guards the base path, so this app cannot re-derive
* a divergent copy of those rules.
*/
function usePaneFromPath() {
	const seg = parsePathSegments(APP_PATH, useLocation().pathname)[0] ?? "";
	if (ALL_PANES.includes(seg)) return seg;
	return seg === "" ? null : DEFAULT_PANE;
}
/**
* One row of the narrow-viewport root list: icon, label, count, chevron.
* iOS-style grouped list rows — the same navigation the settings root list
* uses on a phone, so the two apps read as one product on small screens.
*/
function RootListRow({ pane, count, onOpen }) {
	const Icon = PANE_ICON[pane];
	return /* @__PURE__ */ jsxs(ui_default$2, {
		onClick: onOpen,
		"data-testid": `root-${pane}`,
		className: `flex w-full items-center gap-3 px-3 py-2.5 ${COARSE_TOUCH_TARGET} text-left cursor-pointer hover:bg-bg-hover focus-ring`,
		children: [
			/* @__PURE__ */ jsx(Icon, {
				className: "h-4 w-4 shrink-0 text-accent",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "min-w-0 flex-1 truncate text-[14px] text-text-strong",
				children: i18nT(PANE_LABEL_KEY[pane])
			}),
			count !== void 0 && /* @__PURE__ */ jsx("span", {
				className: "shrink-0 font-mono text-[12px] tabular-nums text-muted",
				children: fmtNumber(count)
			}),
			/* @__PURE__ */ jsx(ChevronRight, {
				className: "h-4 w-4 shrink-0 text-muted",
				"aria-hidden": "true"
			})
		]
	});
}
function AwsControlPage() {
	const navigate = useNavigate$1();
	const location = useLocation();
	const paneFromPath = usePaneFromPath();
	const narrow = useIsNarrowViewport();
	const [storedId, setStoredId] = usePersistedString("awsControl.selectedAccount", "");
	const accountsQ = useAccountsQuery();
	const resolved = (accountsQ.data?.accounts ?? []).filter((a) => Boolean(a.account));
	const selected = resolved.find((a) => a.account === storedId) ?? resolved[0] ?? null;
	const id = selected?.account ?? "";
	const driveQ = useAppQuery(["drive", id], {
		queryFn: () => awsControlApi.drive(id),
		enabled: Boolean(id)
	});
	const drive = driveQ.data;
	const sharesQ = useAppQuery(["shares", id], {
		queryFn: () => awsControlApi.shares(id),
		enabled: Boolean(id)
	});
	const openPane = (p, opts) => {
		const drillIn = narrow && paneFromPath === null;
		const state = {
			...drillIn ? { [SUBNAV_PUSH_STATE]: true } : {},
			...opts?.withAddAccounts ? { [ADD_ACCOUNTS_STATE]: true } : {}
		};
		navigate(`${APP_PATH}/${p}`, {
			replace: !drillIn,
			state: Object.keys(state).length > 0 ? state : void 0
		});
	};
	const useAccount = (a) => {
		setStoredId(a.account);
	};
	const paneCount = (p) => p === "shares" ? sharesQ.data?.shares.length : p === "files" || p === "library" || p === "backup" ? drive?.exists ? drive.usage.sections[p === "files" ? "drive" : p === "library" ? "library" : "backup"].objects : void 0 : void 0;
	if (accountsQ.isError && accountsQ.error instanceof AwsControlError && accountsQ.error.status === 403 && accountsQ.error.message === "app_disabled") return /* @__PURE__ */ jsx("div", {
		className: "flex h-full flex-col",
		children: /* @__PURE__ */ jsx("div", {
			className: "flex-1 overflow-y-auto px-4 py-6 md:px-6",
			children: /* @__PURE__ */ jsx(EmptyState, {
				testId: "aws-control-disabled",
				icon: /* @__PURE__ */ jsx(Cloud, {}),
				title: i18nT("apps.awsControl.page.disabled_title"),
				subtitle: i18nT("apps.awsControl.page.disabled_body")
			})
		})
	});
	if (accountsQ.isError) {
		const forbidden = accountsQ.error instanceof AwsControlError && accountsQ.error.status === 403;
		return /* @__PURE__ */ jsx("div", {
			className: "flex h-full flex-col",
			children: /* @__PURE__ */ jsx("div", {
				className: "flex-1 overflow-y-auto px-4 py-6 md:px-6",
				"data-testid": "accounts-error",
				children: /* @__PURE__ */ jsxs("div", {
					className: "mx-auto flex max-w-[480px] flex-col items-center gap-3 py-12",
					children: [/* @__PURE__ */ jsx(AwsErrorNotice, {
						askAgent: true,
						error: accountsQ.error,
						title: i18nT("apps.awsControl.page.error_title"),
						message: i18nT(forbidden ? "apps.awsControl.page.error_forbidden_body" : "apps.awsControl.page.error_body"),
						className: "w-full",
						testId: "aws-control-error"
					}), /* @__PURE__ */ jsxs(Btn, {
						onClick: () => accountsQ.refetch(),
						"data-testid": "error-retry",
						children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), i18nT("apps.awsControl.page.retry")]
					})]
				})
			})
		});
	}
	if (accountsQ.isLoading || !selected) return /* @__PURE__ */ jsx("div", {
		className: "flex h-full flex-col",
		children: /* @__PURE__ */ jsx("div", {
			className: "flex-1 overflow-y-auto px-4 pt-4 pb-6 md:px-6",
			children: /* @__PURE__ */ jsx(AccountsPane, {
				accountsQ,
				selected: null,
				onUse: useAccount
			})
		})
	});
	const pane = paneFromPath ?? DEFAULT_PANE;
	const wantsAddAccounts = Boolean(location.state?.[ADD_ACCOUNTS_STATE]);
	const paneContent = /* @__PURE__ */ jsxs(Fragment$1, { children: [
		pane === "overview" && /* @__PURE__ */ jsx(OverviewPane, {
			accountsQ,
			selected,
			drive,
			driveQ,
			sharesQ,
			onUse: useAccount,
			onOpenPane: (p) => openPane(p),
			onAddAccount: () => openPane("accounts", { withAddAccounts: true })
		}),
		pane === "files" && /* @__PURE__ */ jsx(DrivePaneGate, {
			pane: "files",
			account: selected,
			drive,
			driveQ,
			children: (bucket) => /* @__PURE__ */ jsx(DriveSectionView, {
				account: id,
				bucket
			})
		}),
		pane === "library" && /* @__PURE__ */ jsx(DrivePaneGate, {
			pane: "library",
			account: selected,
			drive,
			driveQ,
			children: (bucket) => /* @__PURE__ */ jsx(LibrarySection, {
				account: id,
				bucket
			})
		}),
		pane === "backup" && /* @__PURE__ */ jsx(DrivePaneGate, {
			pane: "backup",
			account: selected,
			drive,
			driveQ,
			children: () => /* @__PURE__ */ jsx(BackupSection, { account: id })
		}),
		pane === "shares" && /* @__PURE__ */ jsx(DrivePaneGate, {
			pane: "shares",
			account: selected,
			drive,
			driveQ,
			children: () => /* @__PURE__ */ jsx(AccessSection, { account: id })
		}),
		pane === "accounts" && /* @__PURE__ */ jsx(AccountsPane, {
			accountsQ,
			selected,
			onUse: useAccount,
			openAddAccounts: wantsAddAccounts
		}),
		pane === "usage" && /* @__PURE__ */ jsx(UsagePane, { account: selected })
	] });
	if (narrow) {
		if (!paneFromPath) return /* @__PURE__ */ jsx("div", {
			className: "flex h-full flex-col",
			"data-testid": "aws-root-list",
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex-1 overflow-y-auto px-4 pt-4 pb-6",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "mb-4",
						children: /* @__PURE__ */ jsx(AccountSwitcher, {
							accounts: resolved,
							selected,
							onSelect: (nextId) => setStoredId(nextId),
							onManage: () => openPane("accounts")
						})
					}),
					/* @__PURE__ */ jsx("div", {
						className: "overflow-hidden rounded-lg border border-border bg-card divide-y divide-border",
						children: TOP_PANES.map((p) => /* @__PURE__ */ jsx(RootListRow, {
							pane: p,
							count: paneCount(p),
							onOpen: () => openPane(p)
						}, p))
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-4 overflow-hidden rounded-lg border border-border bg-card divide-y divide-border",
						children: FOOT_PANES.map((p) => /* @__PURE__ */ jsx(RootListRow, {
							pane: p,
							onOpen: () => openPane(p)
						}, p))
					}),
					drive?.exists && /* @__PURE__ */ jsxs("div", {
						className: "mt-4 px-1 text-[11px] leading-relaxed text-muted",
						"data-testid": "rail-meta",
						children: [/* @__PURE__ */ jsx("span", {
							className: "block truncate font-mono",
							children: drive.bucket
						}), /* @__PURE__ */ jsxs("span", {
							className: "block",
							children: [
								i18nT("apps.awsControl.console.stat_stored_value", {
									size: fmtBytes(drive.usage.bytes),
									objects: fmtNumber(drive.usage.objects)
								}),
								" · ",
								drive.region
							]
						})]
					})
				]
			})
		});
		return /* @__PURE__ */ jsx("div", {
			className: "flex h-full flex-col",
			"data-testid": "aws-pane-detail",
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex-1 overflow-y-auto px-4 pb-6",
				children: [/* @__PURE__ */ jsx(NavBackBar, {
					label: i18nT("apps.awsControl.manifest.display_name"),
					onBack: () => {
						if (location.state?.["subnavPush"]) {
							navigate(-1);
							return;
						}
						navigate(APP_PATH, { replace: true });
					},
					className: "-mx-4"
				}), /* @__PURE__ */ jsx("div", { children: paneContent }, id)]
			})
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "flex h-full min-h-0 flex-row",
		children: [/* @__PURE__ */ jsxs("nav", {
			className: "flex w-56 shrink-0 flex-col items-stretch gap-1 border-r border-border px-3 py-3",
			"aria-label": i18nT("apps.awsControl.rail.nav"),
			"data-testid": "aws-rail",
			children: [
				/* @__PURE__ */ jsx(AccountSwitcher, {
					accounts: resolved,
					selected,
					onSelect: (nextId) => setStoredId(nextId),
					onManage: () => openPane("accounts")
				}),
				TOP_PANES.map((p) => /* @__PURE__ */ jsx(RailItem, {
					pane: p,
					active: pane === p,
					onClick: () => openPane(p),
					count: paneCount(p)
				}, p)),
				/* @__PURE__ */ jsx("div", { className: "flex-1" }),
				FOOT_PANES.map((p) => /* @__PURE__ */ jsx(RailItem, {
					pane: p,
					active: pane === p,
					onClick: () => openPane(p)
				}, p)),
				drive?.exists && /* @__PURE__ */ jsxs("div", {
					className: "border-t border-border px-2.5 pt-2 text-[11px] leading-relaxed text-muted",
					"data-testid": "rail-meta",
					children: [/* @__PURE__ */ jsx("span", {
						className: "block truncate font-mono",
						children: drive.bucket
					}), /* @__PURE__ */ jsxs("span", {
						className: "block",
						children: [
							i18nT("apps.awsControl.console.stat_stored_value", {
								size: fmtBytes(drive.usage.bytes),
								objects: fmtNumber(drive.usage.objects)
							}),
							" · ",
							drive.region
						]
					})]
				})
			]
		}), /* @__PURE__ */ jsx("div", {
			className: "min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 md:px-6",
			children: /* @__PURE__ */ jsx("div", { children: paneContent }, id)
		})]
	});
}
// src/index.tsx
/**
* The bundle's entry: AppHost lazy-imports this module and renders its default
* export as the app's page.
*
* Subscribing to the host's language generation here is what repaints the page on
* a language switch: `t` reads the active locale at call time, and this
* component's re-render reaches every child.
*/
function AwsControlApp() {
	useLanguageGeneration();
	return /* @__PURE__ */ jsx(AwsControlPage, {});
}
export { AwsControlApp as default };
