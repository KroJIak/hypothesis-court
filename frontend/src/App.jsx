import { AuthBootstrapScreen, LoginPage } from "./features/auth/components/LoginPage";
import { useAuthSession } from "./features/auth/hooks/useAuthSession";
import { WorkspacePage } from "./features/workspace/components/WorkspacePage";

export default function App() {
  const { status, errorMessage, isSubmitting, authenticate } = useAuthSession();

  if (status === "loading") {
    return <AuthBootstrapScreen />;
  }

  if (status !== "authenticated") {
    return (
      <LoginPage
        errorMessage={errorMessage}
        isSubmitting={isSubmitting}
        onLogin={authenticate}
      />
    );
  }

  return <WorkspacePage />;
}
