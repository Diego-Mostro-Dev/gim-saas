import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-gray-950">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-3xl dark:bg-red-900/30">
            ⚠️
          </div>
          <h1 className="mt-6 text-xl font-bold text-gray-900 dark:text-white">
            Algo salió mal
          </h1>
          <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Se produjo un error inesperado en esta parte de la aplicación.
            Recargá la página para continuar.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}