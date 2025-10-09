use cef::{args::Args, rc::*, *};
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use winit::{
    application::ApplicationHandler,
    event::WindowEvent,
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    platform::pump_events::{EventLoopExtPumpEvents, PumpStatus},
    window::{Window, WindowAttributes, WindowId},
};

// Shared state between CEF and rendering
static TEXTURE_BUFFER: once_cell::sync::Lazy<Arc<RwLock<Vec<u8>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(Vec::new())));
static TEXTURE_SIZE: once_cell::sync::Lazy<Arc<RwLock<(u32, u32)>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new((1024, 768))));
static CEF_INITIALIZED: once_cell::sync::Lazy<Arc<RwLock<bool>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(false)));
static BROWSER_INSTANCE: once_cell::sync::Lazy<Arc<RwLock<Option<Browser>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(None)));

// CEF App implementation
struct DemoApp {
    object: *mut RcImpl<cef_dll_sys::_cef_app_t, Self>,
}

impl DemoApp {
    fn new_app() -> App {
        App::new(Self {
            object: std::ptr::null_mut(),
        })
    }
}

impl WrapApp for DemoApp {
    fn wrap_rc(&mut self, object: *mut RcImpl<cef_dll_sys::_cef_app_t, Self>) {
        self.object = object;
    }
}

impl Clone for DemoApp {
    fn clone(&self) -> Self {
        unsafe {
            let rc_impl = &mut *self.object;
            rc_impl.interface.add_ref();
        }
        Self {
            object: self.object,
        }
    }
}

impl Rc for DemoApp {
    fn as_base(&self) -> &cef_dll_sys::cef_base_ref_counted_t {
        unsafe {
            let base = &*self.object;
            std::mem::transmute(&base.cef_object)
        }
    }
}

impl ImplApp for DemoApp {
    fn get_raw(&self) -> *mut cef_dll_sys::_cef_app_t {
        self.object.cast()
    }

    fn browser_process_handler(&self) -> Option<BrowserProcessHandler> {
        Some(DemoBrowserProcessHandler::new_browser_process_handler())
    }
}

// Browser Process Handler
struct DemoBrowserProcessHandler {
    object: *mut RcImpl<cef_dll_sys::cef_browser_process_handler_t, Self>,
}

impl DemoBrowserProcessHandler {
    fn new_browser_process_handler() -> BrowserProcessHandler {
        BrowserProcessHandler::new(Self {
            object: std::ptr::null_mut(),
        })
    }
}

impl Rc for DemoBrowserProcessHandler {
    fn as_base(&self) -> &cef_dll_sys::cef_base_ref_counted_t {
        unsafe {
            let base = &*self.object;
            std::mem::transmute(&base.cef_object)
        }
    }
}

impl WrapBrowserProcessHandler for DemoBrowserProcessHandler {
    fn wrap_rc(
        &mut self,
        object: *mut RcImpl<cef_dll_sys::_cef_browser_process_handler_t, Self>,
    ) {
        self.object = object;
    }
}

impl Clone for DemoBrowserProcessHandler {
    fn clone(&self) -> Self {
        unsafe {
            let rc_impl = &mut *self.object;
            rc_impl.interface.add_ref();
        }
        Self {
            object: self.object,
        }
    }
}

impl ImplBrowserProcessHandler for DemoBrowserProcessHandler {
    fn get_raw(&self) -> *mut cef_dll_sys::_cef_browser_process_handler_t {
        self.object.cast()
    }

    fn on_context_initialized(&self) {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            println!("CEF context initialized");

            *CEF_INITIALIZED.write() = true;

            let mut client = DemoClient::new_client();
            let url = CefString::from("https://www.google.com");

            let window_info = WindowInfo {
                windowless_rendering_enabled: 1,
                ..Default::default()
            };

            let settings = BrowserSettings::default();

            let _browser = browser_host_create_browser(
                Some(&window_info),
                Some(&mut client),
                Some(&url),
                Some(&settings),
                Option::<&mut DictionaryValue>::None,
                Option::<&mut RequestContext>::None,
            );
        }));
    }
}

// Client
struct DemoClient {
    object: *mut RcImpl<cef_dll_sys::_cef_client_t, Self>,
}

impl DemoClient {
    fn new_client() -> Client {
        Client::new(Self {
            object: std::ptr::null_mut(),
        })
    }
}

impl WrapClient for DemoClient {
    fn wrap_rc(&mut self, object: *mut RcImpl<cef_dll_sys::_cef_client_t, Self>) {
        self.object = object;
    }
}

impl Clone for DemoClient {
    fn clone(&self) -> Self {
        unsafe {
            let rc_impl = &mut *self.object;
            rc_impl.interface.add_ref();
        }
        Self {
            object: self.object,
        }
    }
}

impl Rc for DemoClient {
    fn as_base(&self) -> &cef_dll_sys::cef_base_ref_counted_t {
        unsafe {
            let base = &*self.object;
            std::mem::transmute(&base.cef_object)
        }
    }
}

impl ImplClient for DemoClient {
    fn get_raw(&self) -> *mut cef_dll_sys::_cef_client_t {
        self.object.cast()
    }

    fn render_handler(&self) -> Option<RenderHandler> {
        Some(DemoRenderHandler::new_render_handler())
    }

    fn life_span_handler(&self) -> Option<LifeSpanHandler> {
        Some(DemoLifeSpanHandler::new_life_span_handler())
    }
}

// LifeSpan Handler to capture browser instance
struct DemoLifeSpanHandler {
    object: *mut RcImpl<cef_dll_sys::_cef_life_span_handler_t, Self>,
}

impl DemoLifeSpanHandler {
    fn new_life_span_handler() -> LifeSpanHandler {
        LifeSpanHandler::new(Self {
            object: std::ptr::null_mut(),
        })
    }
}

impl WrapLifeSpanHandler for DemoLifeSpanHandler {
    fn wrap_rc(&mut self, object: *mut RcImpl<cef_dll_sys::_cef_life_span_handler_t, Self>) {
        self.object = object;
    }
}

impl Clone for DemoLifeSpanHandler {
    fn clone(&self) -> Self {
        unsafe {
            let rc_impl = &mut *self.object;
            rc_impl.interface.add_ref();
        }
        Self {
            object: self.object,
        }
    }
}

impl Rc for DemoLifeSpanHandler {
    fn as_base(&self) -> &cef_dll_sys::cef_base_ref_counted_t {
        unsafe {
            let base = &*self.object;
            std::mem::transmute(&base.cef_object)
        }
    }
}

impl ImplLifeSpanHandler for DemoLifeSpanHandler {
    fn get_raw(&self) -> *mut cef_dll_sys::_cef_life_span_handler_t {
        self.object.cast()
    }

    fn on_after_created(&self, browser: Option<&mut Browser>) {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if let Some(browser) = browser {
                // Store the browser instance for later use
                *BROWSER_INSTANCE.write() = Some(browser.clone());
                println!("Browser created and stored!");
            }
        }));
    }
}

// Render Handler
struct DemoRenderHandler {
    object: *mut RcImpl<cef_dll_sys::_cef_render_handler_t, Self>,
}

impl DemoRenderHandler {
    fn new_render_handler() -> RenderHandler {
        RenderHandler::new(Self {
            object: std::ptr::null_mut(),
        })
    }
}

impl WrapRenderHandler for DemoRenderHandler {
    fn wrap_rc(&mut self, object: *mut RcImpl<cef_dll_sys::_cef_render_handler_t, Self>) {
        self.object = object;
    }
}

impl Clone for DemoRenderHandler {
    fn clone(&self) -> Self {
        unsafe {
            let rc_impl = &mut *self.object;
            rc_impl.interface.add_ref();
        }
        Self {
            object: self.object,
        }
    }
}

impl Rc for DemoRenderHandler {
    fn as_base(&self) -> &cef_dll_sys::cef_base_ref_counted_t {
        unsafe {
            let base = &*self.object;
            std::mem::transmute(&base.cef_object)
        }
    }
}

impl ImplRenderHandler for DemoRenderHandler {
    fn get_raw(&self) -> *mut cef_dll_sys::_cef_render_handler_t {
        self.object.cast()
    }

    fn view_rect(&self, _browser: Option<&mut Browser>, rect: Option<&mut Rect>) {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if let Some(rect) = rect {
                let size = TEXTURE_SIZE.read();
                rect.x = 0;
                rect.y = 0;
                rect.width = size.0 as i32;
                rect.height = size.1 as i32;
            }
        }));
    }

    fn on_paint(
        &self,
        _browser: Option<&mut Browser>,
        _type_: PaintElementType,
        _dirty_rects_count: usize,
        _dirty_rects: Option<&Rect>,
        buffer: *const u8,
        width: ::std::os::raw::c_int,
        height: ::std::os::raw::c_int,
    ) {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if buffer.is_null() || width <= 0 || height <= 0 {
                return;
            }

            let size = (width * height * 4) as usize;
            let slice = unsafe { std::slice::from_raw_parts(buffer, size) };

            let mut texture_buffer = TEXTURE_BUFFER.write();
            texture_buffer.clear();
            texture_buffer.extend_from_slice(slice);

            let mut texture_size = TEXTURE_SIZE.write();
            *texture_size = (width as u32, height as u32);
        }));
    }
}

// egui + wgpu Application
struct EguiCefApp {
    window: Option<Arc<Window>>,
    egui_state: Option<EguiState>,
    url_input: String,
    frame_count: u64,
    last_update: Instant,
}

struct EguiState {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    surface_config: wgpu::SurfaceConfiguration,
    egui_renderer: egui_wgpu::Renderer,
    egui_state: egui_winit::State,
    cef_texture: Option<wgpu::Texture>,
}

impl EguiCefApp {
    fn new() -> Self {
        Self {
            window: None,
            egui_state: None,
            url_input: String::from("https://www.google.com"),
            frame_count: 0,
            last_update: Instant::now(),
        }
    }
}

impl ApplicationHandler for EguiCefApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }

        let window_attrs = WindowAttributes::default()
            .with_title("egui + CEF Browser")
            .with_inner_size(winit::dpi::LogicalSize::new(1024, 768));

        let window = Arc::new(event_loop.create_window(window_attrs).unwrap());

        // Initialize wgpu and egui
        let egui_state = pollster::block_on(async {
            let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
                backends: wgpu::Backends::all(),
                ..Default::default()
            });

            let surface = instance.create_surface(window.clone()).unwrap();

            let adapter = instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::default(),
                    compatible_surface: Some(&surface),
                    force_fallback_adapter: false,
                })
                .await
                .unwrap();

            let (device, queue) = adapter
                .request_device(
                    &wgpu::DeviceDescriptor {
                        label: Some("Device"),
                        required_features: wgpu::Features::empty(),
                        required_limits: wgpu::Limits::default(),
                        memory_hints: Default::default(),
                    },
                    None,
                )
                .await
                .unwrap();

            let surface_caps = surface.get_capabilities(&adapter);
            let surface_format = surface_caps
                .formats
                .iter()
                .find(|f| f.is_srgb())
                .copied()
                .unwrap_or(surface_caps.formats[0]);

            let size = window.inner_size();
            let surface_config = wgpu::SurfaceConfiguration {
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                format: surface_format,
                width: size.width,
                height: size.height,
                present_mode: wgpu::PresentMode::AutoVsync,
                alpha_mode: surface_caps.alpha_modes[0],
                view_formats: vec![],
                desired_maximum_frame_latency: 2,
            };

            surface.configure(&device, &surface_config);

            let egui_ctx = egui::Context::default();
            let viewport_id = egui_ctx.viewport_id();
            let max_texture_side = Some(device.limits().max_texture_dimension_2d as usize);
            let egui_state = egui_winit::State::new(
                egui_ctx,
                viewport_id,
                &window,
                Some(window.scale_factor() as f32),
                Some(winit::window::Theme::Dark),
                max_texture_side,
            );

            let egui_renderer = egui_wgpu::Renderer::new(&device, surface_format, None, 1, false);

            EguiState {
                device,
                queue,
                surface,
                surface_config,
                egui_renderer,
                egui_state,
                cef_texture: None,
            }
        });

        self.egui_state = Some(egui_state);
        self.window = Some(window);
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: WindowId, event: WindowEvent) {
        let Some(window) = &self.window else {
            return;
        };
        let Some(state) = &mut self.egui_state else {
            return;
        };

        // Let egui handle the event first
        let response = state.egui_state.on_window_event(window, &event);

        if response.repaint {
            window.request_redraw();
        }

        if response.consumed {
            return;
        }

        match event {
            WindowEvent::CloseRequested => {
                event_loop.exit();
            }
            WindowEvent::Resized(new_size) => {
                if new_size.width > 0 && new_size.height > 0 {
                    state.surface_config.width = new_size.width;
                    state.surface_config.height = new_size.height;
                    state.surface.configure(&state.device, &state.surface_config);
                    window.request_redraw();
                }
            }
            WindowEvent::RedrawRequested => {
                self.render();
            }
            _ => {}
        }
    }
}

impl EguiCefApp {
    fn render(&mut self) {
        let Some(window) = &self.window else {
            return;
        };
        let Some(state) = &mut self.egui_state else {
            return;
        };

        self.frame_count += 1;

        // Build egui UI
        let raw_input = state.egui_state.take_egui_input(window);
        let egui_output = state.egui_state.egui_ctx().run(raw_input, |ctx| {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.heading("🦀 egui + CEF Browser Integration");
                ui.separator();

                ui.horizontal(|ui| {
                    ui.label("URL:");
                    ui.text_edit_singleline(&mut self.url_input);
                    if ui.button("Navigate").clicked() {
                        // Navigate to the URL
                        let url = self.url_input.clone();
                        if let Some(browser) = BROWSER_INSTANCE.read().as_ref() {
                            if let Some(main_frame) = browser.main_frame() {
                                let cef_url = CefString::from(url.as_str());
                                main_frame.load_url(Some(&cef_url));
                            }
                        }
                    }
                });

                ui.separator();

                let cef_ready = *CEF_INITIALIZED.read();
                ui.label(format!("CEF Status: {}", if cef_ready { "✅ Ready" } else { "⏳ Initializing..." }));
                ui.label(format!("Frame: {}", self.frame_count));
                ui.label(format!("FPS: {:.1}", 1.0 / self.last_update.elapsed().as_secs_f32()));

                ui.separator();

                // Display CEF texture
                let texture_buffer = TEXTURE_BUFFER.read();
                let size = TEXTURE_SIZE.read();

                if !texture_buffer.is_empty() && size.0 > 0 && size.1 > 0 {
                    // Update or create wgpu texture from CEF buffer
                    if state.cef_texture.is_none()
                        || state.cef_texture.as_ref().unwrap().width() != size.0
                        || state.cef_texture.as_ref().unwrap().height() != size.1
                    {
                        state.cef_texture = Some(state.device.create_texture(&wgpu::TextureDescriptor {
                            label: Some("CEF Texture"),
                            size: wgpu::Extent3d {
                                width: size.0,
                                height: size.1,
                                depth_or_array_layers: 1,
                            },
                            mip_level_count: 1,
                            sample_count: 1,
                            dimension: wgpu::TextureDimension::D2,
                            format: wgpu::TextureFormat::Rgba8UnormSrgb,
                            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                            view_formats: &[],
                        }));
                    }

                    // Convert BGRA to RGBA
                    let mut rgba_buffer = Vec::with_capacity(texture_buffer.len());
                    for chunk in texture_buffer.chunks_exact(4) {
                        rgba_buffer.push(chunk[2]); // R
                        rgba_buffer.push(chunk[1]); // G
                        rgba_buffer.push(chunk[0]); // B
                        rgba_buffer.push(chunk[3]); // A
                    }

                    if let Some(texture) = &state.cef_texture {
                        state.queue.write_texture(
                            wgpu::ImageCopyTexture {
                                texture,
                                mip_level: 0,
                                origin: wgpu::Origin3d::ZERO,
                                aspect: wgpu::TextureAspect::All,
                            },
                            &rgba_buffer,
                            wgpu::ImageDataLayout {
                                offset: 0,
                                bytes_per_row: Some(4 * size.0),
                                rows_per_image: Some(size.1),
                            },
                            wgpu::Extent3d {
                                width: size.0,
                                height: size.1,
                                depth_or_array_layers: 1,
                            },
                        );

                        // Register texture with egui
                        let texture_id = state.egui_renderer.register_native_texture(
                            &state.device,
                            &texture.create_view(&wgpu::TextureViewDescriptor::default()),
                            wgpu::FilterMode::Linear,
                        );

                        ui.image(egui::ImageSource::Texture(egui::load::SizedTexture::new(
                            texture_id,
                            [size.0 as f32, size.1 as f32],
                        )));
                    }
                } else {
                    ui.label("⏳ Waiting for CEF to render...");
                }
            });
        });

        state.egui_state.handle_platform_output(window, egui_output.platform_output);

        // Render
        let output = state.surface.get_current_texture().unwrap();
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = state.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });

        let screen_descriptor = egui_wgpu::ScreenDescriptor {
            size_in_pixels: [state.surface_config.width, state.surface_config.height],
            pixels_per_point: window.scale_factor() as f32,
        };

        let primitives = state.egui_state.egui_ctx().tessellate(egui_output.shapes, egui_output.pixels_per_point);

        // Update textures
        for (id, image_delta) in &egui_output.textures_delta.set {
            state.egui_renderer.update_texture(&state.device, &state.queue, *id, image_delta);
        }

        // Update buffers
        state.egui_renderer.update_buffers(
            &state.device,
            &state.queue,
            &mut encoder,
            &primitives,
            &screen_descriptor,
        );

        // Render
        {
            let render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.1,
                            g: 0.1,
                            b: 0.1,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Render egui
            state.egui_renderer.render(
                &mut render_pass.forget_lifetime(),
                &primitives,
                &screen_descriptor,
            );
        } // render_pass dropped here automatically

        for id in &egui_output.textures_delta.free {
            state.egui_renderer.free_texture(id);
        }

        state.queue.submit(std::iter::once(encoder.finish()));
        output.present();

        self.last_update = Instant::now();
        window.request_redraw();
    }
}

fn main() {
    env_logger::init();

    #[cfg(target_os = "macos")]
    let _loader = {
        let loader = library_loader::LibraryLoader::new(&std::env::current_exe().unwrap(), false);
        if !loader.load() {
            eprintln!("Failed to load CEF library");
            return;
        }
        loader
    };

    let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);

    let args = Args::new();
    let cmd = args.as_cmd_line().unwrap();

    let switch = CefString::from("type");
    let is_browser_process = cmd.has_switch(Some(&switch)) != 1;

    let mut app = DemoApp::new_app();

    let ret = execute_process(
        Some(args.as_main_args()),
        Some(&mut app),
        std::ptr::null_mut(),
    );

    // Handle non-browser processes (renderer, GPU, etc.)
    if !is_browser_process {
        let process_type = CefString::from(&cmd.switch_value(Some(&switch)));
        println!("launch process {process_type}");
        assert!(ret >= 0, "cannot execute non-browser process");
        return;
    }

    // Browser process - initialize CEF with external message pump
    println!("launch browser process");
    assert!(ret == -1, "cannot execute browser process");

    let mut settings = Settings {
        no_sandbox: !cfg!(feature = "sandbox") as _,
        windowless_rendering_enabled: 1,
        external_message_pump: 1, // Key: allows manual event loop control
        ..Default::default()
    };

    let init_result = initialize(
        Some(args.as_main_args()),
        Some(&mut settings),
        Some(&mut app),
        std::ptr::null_mut(),
    );

    if init_result != 1 {
        eprintln!("Failed to initialize CEF: {}", init_result);
        return;
    }

    println!("CEF initialized successfully with external message pump");

    // Run event loop with manual pumping
    let mut event_loop = EventLoop::new().unwrap();
    event_loop.set_control_flow(ControlFlow::Poll);

    let mut egui_app = EguiCefApp::new();

    loop {
        // Pump CEF messages
        do_message_loop_work();

        // Pump winit events
        let status = event_loop.pump_app_events(Some(Duration::ZERO), &mut egui_app);

        if let PumpStatus::Exit(code) = status {
            println!("Exiting with code: {}", code);
            break;
        }

        // Small sleep to prevent busy-waiting
        std::thread::sleep(Duration::from_millis(1));
    }

    shutdown();
}
