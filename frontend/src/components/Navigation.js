function Navigation() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            My Lists
          </Typography>
          <Button color="inherit" component={Link} to="/">
            All Lists
          </Button>
          <Button color="inherit" component={Link} to="/shared">
            Shared With Me
          </Button>
          {/* ... other buttons ... */}
        </Toolbar>
      </AppBar>
    </Box>
  );
} 